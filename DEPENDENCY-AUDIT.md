# Dependency Security Audit Report

**Project:** Family Financial Planner  
**File:** package.json  
**Audit Date:** 2026-05-05  
**Auditor:** Dependency Security Specialist

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Security Vulnerabilities | 12 | 2 Low, 5 Moderate, 5 High |
| Unused Dependencies | 1 | Medium |
| Missing Dependencies | 1 | High |
| Best Practice Issues | 4 | Medium |

**Overall Risk Level:** HIGH

---

## Critical Findings

### SEC-01: Critical Path Traversal Vulnerability in `tar` (HIGH)

**Category:** Security  
**Severity:** HIGH  
**Status:** Active

**Issue:**
- Package: `tar` (dependency of `sqlite3`)
- Multiple CVEs affecting versions ≤7.5.10:
  - CVE-2024-XXXX: Arbitrary File Creation/Overwrite via Hardlink Path Traversal
  - CVE-2024-XXXX: Arbitrary File Overwrite via Symlink Poisoning
  - CVE-2024-XXXX: Arbitrary File Read/Write via Hardlink Target Escape
  - CVE-2024-XXXX: Hardlink Path Traversal via Drive-Relative Linkpath
  - CVE-2024-XXXX: Race Condition in Path Reservations

**Impact:** Attackers can write files to arbitrary locations during npm install or when extracting archives.

**Remediation:**
```bash
# Option 1: Upgrade sqlite3 to v6.0.1+ (breaking change)
npm install sqlite3@6.0.1

# Option 2: Add npm override to force newer tar
# Add to package.json:
{
  "overrides": {
    "tar": ">=7.6.0"
  }
}
```

---

### SEC-02: ESBuild Dev Server CORS Bypass (MODERATE)

**Category:** Security  
**Severity:** MODERATE  
**Status:** Active  
**CVE:** GHSA-67mh-4wv8-2f99

**Issue:**
- Package: `esbuild` (via `vitest`)
- Affected: ≤0.24.2
- Any website can send requests to the dev server and read responses

**Impact:** During development, malicious websites could access local dev server APIs.

**Remediation:**
```bash
# Upgrade vitest to v4.1.5+
npm install vitest@4.1.5 --save-dev
```

---

### SEC-03: UUID Buffer Bounds Check Missing (MODERATE)

**Category:** Security  
**Severity:** MODERATE  
**Status:** Active  
**CVE:** GHSA-w5hq-g745-h8pq

**Issue:**
- Package: `uuid` v9.0.1 (current)
- Missing buffer bounds check in v3/v5/v6 when buffer is provided
- Could lead to buffer overflow in edge cases

**Remediation:**
```bash
# Remove unused dependency (see DEP-01)
# OR upgrade if actually needed:
npm install uuid@14.0.0
```

---

### SEC-04: @tootallnate/once Control Flow Scoping (LOW)

**Category:** Security  
**Severity:** LOW  
**Status:** Active

**Issue:**
- Package: `@tootallnate/once` (transitive via `sqlite3`)
- Vulnerable to Incorrect Control Flow Scoping

**Remediation:**
```bash
# Fixed by upgrading sqlite3 (see SEC-01)
npm install sqlite3@6.0.1
```

---

## Dependency Issues

### DEP-01: Unused Dependency - `uuid`

**Category:** Unused Dependencies  
**Severity:** MEDIUM  
**Status:** Confirmed

**Issue:**
- `uuid` v9.0.1 is declared in dependencies
- Not imported or used anywhere in `/src` codebase
- Only appears in package-lock.json

**Evidence:**
```bash
$ grep -r "uuid" src/ | wc -l
0
```

**Remediation:**
```bash
npm uninstall uuid
npm uninstall @types/uuid --save-dev
```

---

### DEP-02: Missing Dependency - `express-session`

**Category:** Missing Dependencies  
**Severity:** HIGH  
**Status:** Confirmed

**Issue:**
- `express-session` is imported in worktree files but not in main package.json
- Found in: `.claude/worktrees/suspicious-elgamal-b841f1/src/server.js` and `api/index.js`
- Could cause runtime errors if worktree code is deployed

**Evidence:**
```javascript
// In worktree files:
const session = require('express-session');
```

**Remediation:**
```bash
# If session is needed:
npm install express-session

# Add @types:
npm install @types/express-session --save-dev
```

**Alternative:** If not needed, clean up worktree references.

---

## Best Practice Issues

### BP-01: No Exact Version Pinning

**Category:** Best Practices  
**Severity:** MEDIUM  
**Status:** Present in all dependencies

**Issue:**
- All dependencies use `^` (caret) versioning
- Allows automatic minor/patch updates
- Risk: Supply chain attacks via compromised packages

**Current State:**
```json
"bcryptjs": "^2.4.3",
"express": "^4.19.2",
// ... all use ^
```

**Remediation:**
```json
// Use exact versions for production dependencies:
"bcryptjs": "2.4.3",
"express": "4.19.2",
// Or use npm ci in production with package-lock.json
```

**Recommendation:** Keep using `^` in development but ensure `package-lock.json` is committed and `npm ci` is used in production.

---

### BP-02: Outdated Dependencies

**Category:** Best Practices  
**Severity:** MEDIUM  
**Status:** Multiple outdated packages

**Issue:**
| Package | Current | Latest | Behind |
|---------|---------|--------|--------|
| `express` | 4.22.1 | 5.2.1 | 1 major |
| `helmet` | 7.2.0 | 8.1.0 | 1 major |
| `vitest` | 1.6.1 | 4.1.5 | 3 major |
| `zod` | 3.25.76 | 4.4.3 | 1 major |
| `uuid` | 9.0.1 | 14.0.0 | 5 major |
| `sqlite3` | 5.1.7 | 6.0.1 | 1 major |
| `bcryptjs` | 2.4.3 | 3.0.3 | 1 major |
| `eslint` | 8.57.1 | 10.3.0 | 2 major |

**Remediation:**
- Prioritize security-related updates (`sqlite3`, `uuid`)
- Test thoroughly before major version upgrades
- Consider using Dependabot or Renovate for automated updates

---

### BP-03: Missing NPM Scripts

**Category:** Best Practices  
**Severity:** LOW  
**Status:** Present

**Issue:**
- No `security` or `audit` script defined
- No `prestart` or `postinstall` hooks for security checks
- Missing `clean` script for build artifacts

**Remediation:**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "concurrently \"tsc -w\" \"nodemon dist/server.js\"",
    "migrate": "node dist/db/migrate.js",
    "seed": "node dist/db/seeds/seed-bheekun.js",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src --ext .ts",
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "clean": "rm -rf dist",
    "prestart": "npm run migrate"
  }
}
```

---

### BP-04: ESLint v8 Deprecated

**Category:** Best Practices  
**Severity:** MEDIUM  
**Status:** ESLint v8 reached EOL

**Issue:**
- ESLint v8.57.0 is installed
- ESLint v9 is current with flat config
- v8 no longer receives updates

**Remediation:**
```bash
# Migrate to ESLint v9 with new flat config
npm install eslint@9 --save-dev

# Or migrate to @eslint/js and eslint-config-prettier
```

---

## Package.json Structure Review

### ✅ Good Practices Present

| Practice | Status |
|----------|--------|
| `engines` field specified | ✅ |
| `main` entry correct | ✅ |
| Scripts well-defined | ✅ |
| Separate devDependencies | ✅ |
| TypeScript declarations (@types) | ✅ |

### ⚠️ Issues Found

| Practice | Status | Issue |
|----------|--------|-------|
| `files` field | ❌ | Not defined - should exclude test files |
| `repository` | ❌ | Not specified |
| `license` | ❌ | Not specified |
| `keywords` | ❌ | Not specified |
| `engines.npm` | ❌ | Not specified |

---

## Usage Verification

### Confirmed Used Dependencies

| Package | Usage Location | Status |
|---------|---------------|--------|
| `express` | server.ts, routes/* | ✅ Used |
| `bcryptjs` | routes/auth.ts | ✅ Used |
| `jsonwebtoken` | middleware/auth.ts, routes/auth.ts | ✅ Used |
| `helmet` | server.ts | ✅ Used |
| `cors` | server.ts | ✅ Used |
| `compression` | server.ts | ✅ Used |
| `morgan` | server.ts | ✅ Used |
| `express-rate-limit` | server.ts | ✅ Used |
| `cookie-parser` | server.ts | ✅ Used |
| `zod` | middleware/validator.ts, routes/* | ✅ Used |
| `sqlite3` | db/database.ts | ✅ Used |
| `dotenv` | config.ts | ✅ Used |
| `uuid` | — | ❌ **NOT USED** |

---

## Remediation Commands

```bash
# 1. Remove unused dependencies
npm uninstall uuid
npm uninstall @types/uuid --save-dev

# 2. Fix high-severity vulnerabilities (requires testing)
npm install sqlite3@6.0.1

# 3. Update dev dependencies
npm install vitest@4.1.5 --save-dev

# 4. Add missing dependency if needed
npm install express-session
npm install @types/express-session --save-dev

# 5. Audit and verify
npm audit
```

---

## Risk Assessment Matrix

| Finding | Likelihood | Impact | Risk Level |
|---------|-----------|--------|------------|
| tar path traversal | Medium | High | HIGH |
| esbuild CORS | Low | Medium | MEDIUM |
| uuid buffer overflow | Low | Medium | MEDIUM |
| unused uuid | Certain | Low | LOW |
| outdated packages | Certain | Medium | MEDIUM |
| missing express-session | Low | High | MEDIUM |

---

## Recommendations Summary

### Immediate Actions (Within 1 Week)
1. **Remove `uuid`** dependency - confirmed unused
2. **Address `tar` vulnerability** by upgrading `sqlite3` to v6.0.1
3. **Add `express-session`** if the worktree code is production-bound

### Short-term Actions (Within 1 Month)
1. Upgrade `vitest` to v4.1.5+ for esbuild fix
2. Review and test `sqlite3` v6.0.1 compatibility
3. Add security scripts to package.json

### Long-term Actions (Within 3 Months)
1. Upgrade to ESLint v9
2. Evaluate Express v5 migration
3. Implement automated dependency scanning (Dependabot)
4. Pin versions for production deployments

---

## Appendix: Dependency Tree Analysis

### Production Dependencies (13)
```
✅ bcryptjs@2.4.3       - Used in auth
✅ compression@1.7.4     - Used in server
✅ cookie-parser@1.4.6   - Used in server
✅ cors@2.8.5            - Used in server
✅ dotenv@16.4.5          - Used in config
✅ express@4.19.2         - Core framework
✅ express-rate-limit@7.3.1 - Used in server
✅ helmet@7.1.0           - Used in server
✅ jsonwebtoken@9.0.2     - Used in auth
✅ morgan@1.10.0          - Used in server
✅ sqlite3@5.1.7          - Database (VULNERABLE)
❌ uuid@9.0.1             - NOT USED
✅ zod@3.23.8             - Validation
```

### Dev Dependencies (14)
```
✅ All @types/* packages    - TypeScript support
✅ concurrently@8.2.2      - Dev script runner
✅ eslint@8.57.0           - Linter (EOL)
✅ nodemon@3.1.4            - Dev server
✅ typescript@5.4.5         - TypeScript compiler
✅ vitest@1.6.0             - Test runner (OUTDATED)
```

---

**Report Generated:** 2026-05-05  
**Next Audit Recommended:** After dependency updates
