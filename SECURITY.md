# Security Policy

## Supported Versions

The following table outlines which versions of **Orval** currently receive security updates.

| Version                | Supported              |
| ---------------------- | ---------------------- |
| Latest major release   | ✅                     |
| Previous major release | ⚠️ Security fixes only |
| Older releases         | ❌                     |

> **Note**  
> Security fixes are applied only to supported versions. Users are strongly encouraged to upgrade to the latest release whenever possible.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Orval, **please do not open a public issue**.

### How to Report

- Report security issues via **GitHub Security Advisories**:  
  https://github.com/orval-labs/orval/security/advisories
- Alternatively, you may contact the maintainers privately via email if listed in the repository.

### What to Include

Please include as much of the following information as possible:

- A detailed description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any known mitigations or workarounds
- Relevant version(s) of Orval affected

### Response Process

- You can expect an initial acknowledgment **within 72 hours**
- We will investigate and validate the report
- If accepted, we will work on a fix and coordinate a responsible disclosure
- If declined, we will provide an explanation where possible

### Disclosure

Once a fix is released:

- A GitHub Security Advisory may be published
- The vulnerability will be documented in the release notes
- Credit will be given to the reporter unless anonymity is requested

---

## Security Best Practices for Users

- Always use the latest supported version of Orval
- Review generated client code before deploying to production
- Avoid committing generated secrets or tokens to version control
- Follow general dependency and supply-chain security best practices

---

Thank you for helping keep Orval and its community secure 🙏
