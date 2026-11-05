# Setup

Tested on Home Assistant 2026.10 (Home Assistant OS).

## 1. Gmail

1. Create a label called `AlertasEmpleo` (no spaces: Home Assistant doesn't accept labels with spaces).
2. In **Settings → Labels**, make sure **Show in IMAP** is ticked for that label.
3. Create a filter for your alert senders and apply the label, for example:
   ```
   from:(jobalerts-noreply@linkedin.com OR alertas@push.tecnoempleo.com)
   ```
4. Turn on 2-step verification and create an **app password** for Home Assistant. Don't use your normal password.

## 2. IMAP integration

**Settings → Devices & services → Add integration → IMAP**

- Server: `imap.gmail.com`, port `993`
- User: your Gmail address. Password: the app password.
- Folder: `AlertasEmpleo`
- Search: `UnSeen UnDeleted`

The integration fires an `imap_content` event for every new email in that folder.

## 3. Anthropic integration

1. Create an API key at [console.anthropic.com](https://console.anthropic.com). The API is billed separately from a Claude.ai subscription.
2. **Add integration → Anthropic**, paste the key.
3. Add an **AI Task** entity with:
   - Model: Claude Haiku 4.5
   - Max tokens: 4000 (raise to 6000 if you see "output token limit")
   - Thinking budget: 0
   - Code execution and web search: off
4. In **Settings → System → AI**, set it as the default AI Task entity.

## 4. To-do list

**Add integration → Local To-do**, name it `Ofertas empleo`. The entity will be `todo.ofertas_empleo`.

On your dashboard, add a To-do list card and set sorting to **Alphabetical (Z–A)**, so the highest scores appear first.

## 5. Phone notifications

Install the Home Assistant Companion app and log in. Your notify service will be something like `notify.mobile_app_<your_phone>`.

## 6. Automation

1. **Settings → Automations → Create automation → Edit in YAML**.
2. Paste [`automation/job_alert_bot.yaml`](../automation/job_alert_bot.yaml).
3. Change:
   - `notify.mobile_app_your_phone` to your notify service;
   - every `{# ... #}` block in the prompt (profile, what you're looking for, scoring rules and companies you're not interested in). Each comment says what to write there.
4. Save.

## Testing

Mark one or two alert emails in the label as unread. Within a minute the automation should run. If something fails, open the automation's **Traces** to see the email text, the model's answer and the offers that passed the filter.
