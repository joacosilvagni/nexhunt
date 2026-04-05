export const BACKEND_PORT = 17707
export const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`
export const WS_BASE = `ws://127.0.0.1:${BACKEND_PORT}`

export const PROXY_DEFAULT_PORT = 8080

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const
export type Severity = (typeof SEVERITY_ORDER)[number]

export const VULN_TYPES = [
  'sqli', 'xss', 'ssrf', 'lfi', 'rfi', 'rce', 'idor',
  'open-redirect', 'csrf', 'ssti', 'xxe', 'cors',
  'info-disclosure', 'auth-bypass', 'other'
] as const

export const TOOL_CATEGORIES = {
  recon: ['subfinder', 'amass', 'httpx', 'nmap', 'whatweb', 'waybackurls', 'gau', 'katana', 'paramspider', 'arjun'],
  scanner: ['nuclei', 'nikto', 'ffuf', 'gobuster', 'dirsearch'],
  exploit: ['sqlmap', 'dalfox', 'xsstrike', 'commix']
} as const
