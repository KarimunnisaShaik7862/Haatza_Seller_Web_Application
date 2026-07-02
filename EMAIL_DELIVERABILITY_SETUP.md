# Email Deliverability & DNS Authentication Setup Guide

This guide describes the DNS record configurations and backend email headers alignment required to guarantee that transaction and password reset emails sent from `haatzaseller.com` land in the user's **Inbox** instead of their **Spam/Junk** folder.

---

## 1. DNS Records Configuration (DNS Registrar)

To authenticate your sending domain and authorize your mail servers, you must configure the following standard DNS TXT records with your domain registrar (e.g. GoDaddy, Wix, Route 53, Cloudflare).

### A. SPF (Sender Policy Framework) Record
An SPF record tells recipient mail servers which IPs and services are authorized to send email on behalf of your domain.

* **Type**: `TXT`
* **Host/Name**: `@`
* **Value/Content**: `v=spf1 include:secureserver.net include:_spf.wix.com include:sendgrid.net ~all`

> [!NOTE]
> Adjust the `include:` tags based on the services you use to send emails.
> - `include:secureserver.net` if your domain uses GoDaddy corporate mail.
> - `include:_spf.wix.com` if you use Wix built-in mailboxes.
> - `include:sendgrid.net` if you route Wix transactional emails via SendGrid SMTP.
> - Ensure you have **exactly one** SPF record on your domain.

---

### B. DKIM (DomainKeys Identified Mail) Record
DKIM adds a cryptographic signature to emails. Recipient servers use the public DKIM key in your DNS zone to verify that the email was actually sent by the domain owner and has not been modified in transit.

1. Generate the DKIM keys in your Wix Dashboard or your SMTP Provider panel (e.g., SendGrid/Amazon SES).
2. Create the TXT records provided by your provider. Typically, they look like this:

* **Type**: `TXT` or `CNAME` (depending on provider)
* **Host/Name**: `s1._domainkey` (or selector provided by Wix)
* **Value/Content**: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQ...[Your Unique Public Key]`

---

### C. DMARC (Domain-based Message Authentication, Reporting, and Conformance) Record
DMARC uses SPF and DKIM to determine the authenticity of an email message. It defines policies on what the recipient should do if the check fails (e.g., monitor, quarantine, or reject).

* **Type**: `TXT`
* **Host/Name**: `_dmarc` (or `_dmarc.haatzaseller.com`)
* **Value/Content**: `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@haatzaseller.com; aspf=r; adkim=r`

> [!TIP]
> - `p=quarantine` instructs recipient servers to send failed checks to Spam. Once your SPF and DKIM are validated as passing, you can upgrade this to `p=reject` to block spoofers completely.
> - Replace `dmarc-reports@haatzaseller.com` with a valid inbox where you wish to receive DMARC XML reports.

---

## 2. Wix / Velo Sender Headers Alignment

When sending the email via the backend Wix Velo function (`https://haatzaseller.com/_functions/forgotPassword`), verify that the sending headers match your domain identity.

### A. Sender Address Domain Alignment
- Recipient servers flag messages where the envelope "From" address domain does not match the signing DKIM domain (e.g. sending from a gmail/yahoo address but signed by `haatzaseller.com`).
- Ensure your Wix transactional email setup uses a sender email address aligned with your domain:
  - **Correct**: `no-reply@haatzaseller.com` or `support@haatzaseller.com`
  - **Incorrect**: `haatzaseller@gmail.com` or `no-reply@haatza.wix.com`

### B. Verify Sender Email on Wix / SendGrid
- If using SendGrid or Wix's triggered emails, you **must** complete the "Sender Identity Verification" or "Domain Authentication" steps in their dashboard.

---

## 3. Email Content Best Practices

Ensure your automated password reset template does not trip standard spam filters:
- **Professional Subject Line**: Avoid using all-caps, excessive punctuation (e.g. `RESET PASSWORD!!!`), or clickbait words. Use `Haatza - Password Reset Request` or `Reset your Haatza Seller password`.
- **Text-to-Image Ratio**: Ensure you include clean text explaining the link. Avoid templates consisting entirely of a single clickable image banner.
- **Valid Links**: The reset link should lead directly to your secure domain: `https://haatzaseller.com/reset-password?token=...` or similar. Avoid public link shorteners (e.g. `bit.ly` or `tinyurl`) which are heavily blocked by filters.

---

## 4. Verification Tools

Once DNS records are updated (DNS changes can take up to 24–48 hours to propagate globally), you can verify your configuration using these free tools:
1. **MXToolbox**: Check [mxtoolbox.com/spf.aspx](https://mxtoolbox.com/spf.aspx) to verify your SPF, DKIM, and DMARC syntax.
2. **Mail-Tester**: Send a test email from your Wix application to [mail-tester.com](https://www.mail-tester.com/) to evaluate your deliverability score out of 10.
