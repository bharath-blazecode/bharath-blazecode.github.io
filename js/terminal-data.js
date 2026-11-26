// Static text for the simulated terminal, taken from the site pages.
const raw = String.raw;

export const BIN = '%PDF';

const note = '# Illustrative events written for this site. Not recorded telemetry.';

export const tree = {
  'README.md': `Barry Sampath, field notes.
This is a small simulated shell. It reads static text and nothing else.

about/        who I am, education, tools
work/         homelab, classquest, luna, competitions
experience/   paid work, placements, club roles
research/     the question I am working on. No results yet
contact/      email and links
logs/         illustrative Sysmon and Wazuh events for the home lab
resume.pdf    try: open resume.pdf

Try: cat work/homelab/README.md
Then: grep -i powershell logs/*.log`,
  'resume.pdf': BIN,
  about: {
    'bio.txt': `Barry Sampath. Brisbane, Australia.
I'm a cybersecurity and AI student at QUT. I work on identity controls and
IT automation, and research whether AI can assess cyber risk.
I grew up in the UAE and moved to Brisbane for university. Starting again in
a new country made me comfortable working through unfamiliar systems one
piece at a time.
I'm drawn to blue-team security, identity and access, and the decisions
behind security controls.`,
    'education.txt': `Bachelor of Information Technology, Cybersecurity and AI
  QUT. Expected December 2027. GPA 6.09 / 7.00
Diploma of Information Technology
  QUT. Completed November 2025. GPA 6.25 / 7.00`,
    'tools.txt': `Identity and automation: Entra ID, Microsoft 365, Power Platform, Python, PowerShell
Security lab: Wazuh, Sysmon, Linux, VMware
Project stack: SQL, React, TypeScript, FastAPI, Flask, OpenCV, Git`
  },
  work: {
    homelab: {
      'README.md': `ITDR Home Lab. A personal identity threat detection and response lab,
started in June 2026.
Phase 1 collected endpoint telemetry with Wazuh 4.9.2 and Sysmon 15.20 on one
laptop: an Ubuntu Server 22.04 VM running Wazuh all-in-one, and a Windows 11
Enterprise VM as the monitored endpoint, under VMware Workstation.
My part: I built and documented the environment, enrolled the Windows
endpoint and resolved storage and network faults.
See ~/logs for an illustrative example of how process events become a question.`,
      'status.txt': `Phase 1 complete. Development paused.
The lab is paused while university assessment and paid work take priority.
Phase 2 is detection-rule development and incident-response exercises.
Detection rules are future work. No detection or response time is claimed.`,
      'faults.txt': `Four faults, in the order they happened.
1. VM storage corrupting: OneDrive was syncing the folder holding the .vmdk files. Moved the VMs out.
2. Server unreachable: a stale netplan address from a subnet that no longer existed. Rewrote netplan.
3. Indexer stalling: the 50 GB disk hit 99%. Expanded to 100 GB with LVM, no rebuild.
4. SSH dead on NAT: reverted to bridged. NAT restoration is documented and queued.
Each fault showed up a layer above its cause.`
    },
    classquest: {
      'README.md': `ClassQuest. Lecture material becomes playable quests.
Built by a team of five at Code Network's Winter Hackathon, 21 to 23 August 2026.
People's Choice Award after audience voting across 15 teams.
Stack: React, TypeScript, FastAPI, Python, SQLite.
Miguel Pineda led the technical build. The award belongs to the team.
Three-day build, with team refinement afterwards.`,
      'my-part.txt': `Ten merged pull requests:
  the playable demo and learning loop
  the frontend foundation: sign-in, onboarding, server create and join
  upload security: the server chooses the storage name, bounded reads, regression tests
  cohort learning and preferences
I presented during the judging Q&A.
I was a Code Network Event Officer while competing. The executive cleared this before the event.`
    },
    luna: {
      'README.md': `LUNA. A Raspberry Pi 4B robot on the Hiwonder TurboPi platform,
built with Zhirui Lu at QUT, July to November 2025.
It combines computer vision, offline voice commands, wireless control and
PID-tuned movement. Python, OpenCV, NumPy, Flask, Tkinter.
Completed with Zhirui Lu, November 2025.`,
      'my-part.txt': `Mine: WonderEcho voice control, voice-triggered line following, hardware setup
and repair, support for Flask command routing, PID tuning after Zhirui's first
implementation, documentation.
Zhirui Lu: Flask control workflow, ball tracking, initial PID implementation.
Final integration was shared. The vendor line-following routine is not mine.`
    },
    competitions: {
      'README.md': `Five CTFs and a hackathon, 2026. Every placement is a team result.
I did the practical work hands-on and used AI tools as a guide on some
events, It's Downtime! included.`,
      'results.txt': `CIMCTF 2026 (Mar 2026): 3rd place overall, Team SushiShield
Winter Hackathon (21 to 23 Aug 2026): People's Choice Award, 15 teams, ClassQuest
It's Downtime!, TryHackMe (22 to 26 Oct 2026): 476th of 1,629 ranked teams, 1,150 XP, Team SushiShield, with Alan Nguyen
Holmes CTF 2026, Hack The Box (17 to 21 Sep 2026): 1,097th of 5,637 teams, 8 of 111 challenges, 825 points, Team SushiShield
CSAW CTF Qualifications (18 to 20 Sep 2026): 189th of 530 teams, Team SushiShield
ByteMe CTF (9 to 10 Oct 2026): certificate of participation, no placement`
    }
  },
  experience: {
    'sciencegears.txt': `Cybersecurity and IT Automation Analyst
ScienceGears. Apr 2026 to present. Paid contract.
Identity security and access governance in a live Microsoft 365 environment.
  Reviewed identity controls and wrote prioritised remediation guidance.
  Managed MFA, Conditional Access and role-based access controls in Microsoft Entra ID.
  Built email-triage and IT workflow automations using AI-assisted processing and Python.`,
    'tech.txt': `Technical Lead, QUT The Emerging Coders Hub (TECH)
Oct 2026 to present. Club executive.
Coordinate two Technical Officers on practical projects and the technical
side of club events.`,
    'dynamx.txt': `Technology Consultant, Power Platform
DynamX Institute. Apr to May 2026. Program placement.
Analysed a client scenario, built a Power Platform business system and
presented the solution and its design choices to program assessors.`,
    'code-network.txt': `Engagement Officer, Code Network. Sep 2026 to present. Committee role.
  Welcome new and returning members and help them connect with other attendees.
Event Officer, Code Network. Mar to Sep 2026. Previous committee role.
  Coordinated venues, schedules and communication for events with up to 40 participants.`,
    'coles.txt': `Customer Service Supervisor
Coles Group. May 2025 to present. Part-time.
Supervised customer service, resolved escalated complaints during peak periods
and trained more than 20 team members in point-of-sale procedures, refunds and
customer communication.`
  },
  research: {
    'question.txt': `QUT Vacation Research Experience Scheme. Nov 2026 to present. In progress.
The question: can AI help assess cyber risk?
The work: exploring how large language models can analyse security evidence
against the ASD Essentials, the Australian Signals Directorate's framework
that succeeds the Essential Eight.
The concern: helping design and evaluate experiments to test how far
AI-based assessments can be trusted.
This is a question I am working on, not a finding. There are no results yet.`,
    'supervision.txt': `Supervised by Dr Gowri Sankar Ramachandran at QUT, with Kat McCrabb of
Flame Tree Cyber as external supervisor. Atticus D'Mello is the QUT contact
for the project.`
  },
  contact: {
    'email.txt': `barry.sampath@outlook.com
Brisbane, Australia. Open to 2027 roles.
Work rights are subject to student visa conditions.`,
    'links.txt': `LinkedIn: https://www.linkedin.com/in/barrysampath
GitHub:   https://github.com/bharath-blazecode
Resume:   open resume.pdf`
  },
  logs: {
    'README.txt': `${note}
The home lab story: Word starts PowerShell. A document is opened and
powershell.exe appears as its child, hidden, with an encoded command.
That alone proves nothing. It is a question to ask.
Try: grep WINWORD sysmon-process.log, then tail -n 2 wazuh-alerts.log`,
    'sysmon-process.log': raw`${note}
# Sysmon Event ID 1, process creation. One event per line.
UtcTime="2026-11-12 03:10:02.118" EventID=1 Computer=win11-lab Image="C:\Windows\System32\notepad.exe" CommandLine="notepad.exe" ParentImage="C:\Windows\explorer.exe" User="LAB\student"
UtcTime="2026-11-12 03:12:41.730" EventID=1 Computer=win11-lab Image="C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" CommandLine="\"WINWORD.EXE\" \"C:\Users\student\Documents\invoice-2026-114.docm\"" ParentImage="C:\Windows\explorer.exe" User="LAB\student"
UtcTime="2026-11-12 03:14:05.412" EventID=1 Computer=win11-lab Image="C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" CommandLine="powershell.exe -nop -w hidden -enc VwByAGkAdABlAC0ASABvAHMAdAAgACcAbABhAGIAIABkAGUAbQBvACcA" ParentImage="C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" User="LAB\student"`,
    'sysmon-network.log': `${note}
# Sysmon Event ID 3, network connection. One event per line.
UtcTime="2026-11-12 03:11:50.006" EventID=3 Computer=win11-lab Image="C:\\Program Files (x86)\\ossec-agent\\wazuh-agent.exe" Protocol=tcp SourceIp=192.168.56.101 SourcePort=51822 DestinationIp=192.168.56.10 DestinationPort=1514 User="NT AUTHORITY\\SYSTEM"
UtcTime="2026-11-12 03:14:09.551" EventID=3 Computer=win11-lab Image="C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" Protocol=tcp SourceIp=192.168.56.101 SourcePort=51904 DestinationIp=192.168.56.20 DestinationPort=8080 User="LAB\\student"`,
    'wazuh-alerts.log': `${note}
# Wazuh alerts, one per line. Rule 100210 is a sample local rule.
2026 Nov 12 03:12:41 (win11-lab) any->EventChannel Rule: 61603 (level 3) -> 'Sysmon - Event 1: Process creation' image=WINWORD.EXE parent=explorer.exe user=LAB\\student
2026 Nov 12 03:14:05 (win11-lab) any->EventChannel Rule: 100210 (level 12) -> 'Office application started PowerShell with an encoded command' mitre=T1059.001 image=powershell.exe parent=WINWORD.EXE user=LAB\\student
2026 Nov 12 03:14:09 (win11-lab) any->EventChannel Rule: 61605 (level 3) -> 'Sysmon - Event 3: Network connection' image=powershell.exe dst=192.168.56.20:8080 user=LAB\\student`
  }
};

// Where each path opens on the site. The nearest parent with an entry wins.
export const links = {
  '': '',
  about: '#about', work: '#work', research: '#research', contact: '#contact', experience: '#experience',
  'work/homelab': 'work/homelab/', 'work/classquest': 'work/classquest/', 'work/luna': 'work/luna/',
  'work/competitions': 'work/competitions/', logs: 'work/homelab/#example',
  'resume.pdf': 'resume/Barry_Sampath_Resume.pdf',
  'experience/sciencegears.txt': '#experience-sciencegears', 'experience/tech.txt': '#experience-tech',
  'experience/dynamx.txt': '#experience-dynamx', 'experience/code-network.txt': '#experience-engagement',
  'experience/coles.txt': '#experience-coles'
};

// [summary, synopsis, description]. Order is the order shown by help.
export const man = {
  ls: ['list directory contents', 'ls [-l] [-a] [PATH]...', 'Lists files and folders. -l is long format, -a includes hidden files.'],
  cd: ['change directory', 'cd [PATH]', 'cd alone or cd ~ goes home. cd - goes back. cd .. goes up.'],
  pwd: ['print working directory', 'pwd', 'Prints the full path of the current folder.'],
  cat: ['print files', 'cat FILE...', 'Prints one or more files.'],
  tree: ['show folders as a tree', 'tree [-a] [PATH]', 'Draws the folder structure.'],
  grep: ['search text', 'grep [-i] [-n] [-c] [-v] [-r] PATTERN [FILE]...', 'Prints lines that match PATTERN. -i ignores case, -n adds line numbers, -c counts, -v inverts, -r searches folders. Reads a pipe when no file is given.'],
  find: ['find files by name', 'find [PATH] [-name PATTERN] [-type f|d]', 'Example: find . -name "*.txt"'],
  head: ['first lines of a file', 'head [-n N] [FILE]...', 'Prints the first N lines, 10 by default. Reads a pipe when no file is given.'],
  tail: ['last lines of a file', 'tail [-n N] [FILE]...', 'Prints the last N lines, 10 by default. Reads a pipe when no file is given.'],
  wc: ['count lines, words, bytes', 'wc [-l] [-w] [-c] [FILE]...', 'Often used at the end of a pipe: grep x file | wc -l'],
  echo: ['print text', 'echo [TEXT]...', 'Prints its arguments as plain text.'],
  whoami: ['print the user name', 'whoami', 'Prints the simulated user.'],
  uname: ['print system name', 'uname [-a]', 'Prints the simulated system name.'],
  date: ['print the date', 'date', 'Uses your browser clock.'],
  history: ['commands from this visit', 'history', 'Kept in memory only. Gone when you leave the page.'],
  clear: ['clear the screen', 'clear', 'Ctrl+L does the same.'],
  man: ['show a manual page', 'man COMMAND', 'Short pages for the commands here.'],
  help: ['list commands', 'help', 'Lists the commands and key hints.'],
  open: ['go to a page on the site', 'open PATH', 'Opens the page or section for PATH. open resume.pdf opens the PDF.'],
  exit: ['close the terminal', 'exit', 'Returns you to the page.']
};

const kinds = {
  scan: ['nmap masscan nikto sqlmap hydra msfconsole hashcat john', c => c + ': not run. Testing a system needs written permission from its owner, and this page has no target and no network. Nothing was run.'],
  net: ['ssh scp telnet ftp curl wget nc ping', c => c + ': not run. This terminal makes no network connections, so there is nobody to reach. Nothing was run.'],
  priv: ['sudo su', c => c + ': not run. Nothing in here needs more privilege, which suits least privilege. Nothing was run.'],
  edit: ['rm rmdir mv cp mkdir touch chmod chown', c => c + ': not run. The files here are read-only text, so nothing can change. Nothing was run.'],
  prog: ['bash sh python node', c => c + ': not run. There is no interpreter in this sandbox. Nothing was run.']
};

export const refuse = {};
for (const [names, say] of Object.values(kinds)) for (const n of names.split(' ')) refuse[n] = say;
