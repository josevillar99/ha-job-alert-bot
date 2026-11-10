# Setup

Tested on Home Assistant 2026.11 (Home Assistant OS).

The automation comes with two people, `yo` and `pareja`. If you only need one, delete the second trigger and its block in `perfiles`. To add more, copy a trigger, a `perfiles` block and a profile in the prompt.

## 1. Gmail

For each person:

1. Create a label, for example `AlertasEmpleo` and `AlertasEmpleoPareja` (no spaces: Home Assistant doesn't accept labels with spaces).
2. In **Settings → Labels**, make sure **Show in IMAP** is ticked for that label.
3. Create a filter for the alert senders and apply the label, for example:
   ```
   from:(jobalerts-noreply@linkedin.com OR alertas@push.tecnoempleo.com)
   ```
   If the other person forwards their alerts to your inbox, the filter is: **From** their address, **Has the words** `"jobalerts-noreply@linkedin.com"`.

Then turn on 2-step verification and create an **app password** for Home Assistant. Don't use your normal password.

## 2. IMAP integration

**Settings → Devices & services → Add integration → IMAP**, once per label:

- Server: `imap.gmail.com`, port `993`
- User: your Gmail address. Password: the app password.
- Folder: the label, written exactly the same (`AlertasEmpleo`, `AlertasEmpleoPareja`)
- Search: `UnSeen UnDeleted`

Each entry fires an `imap_content` event with its `folder`, and the automation uses it to pick the profile.

## 3. Anthropic integration

1. Create an API key at [console.anthropic.com](https://console.anthropic.com). The API is billed separately from a Claude.ai subscription.
2. **Add integration → Anthropic**, paste the key.
3. Add an **AI Task** entity with:
   - Model: Claude Haiku 4.5
   - Max tokens: 4000 (raise to 6000 if you see "output token limit")
   - Thinking budget: 0
   - Code execution and web search: off
4. In **Settings → System → AI**, set it as the default AI Task entity.

## 4. To-do lists

**Add integration → Local To-do**, once per person: for example `Ofertas empleo` (`todo.ofertas_empleo`) and `Ofertas pareja` (`todo.ofertas_pareja`).

## 5. Phone notifications

Install the Home Assistant Companion app on each phone and log in. Each phone gets a notify service like `notify.mobile_app_<phone_name>`. You can find the names in **Developer tools → Actions** by typing `mobile_app`.

Notifications arrive even when the phone can't reach Home Assistant (away from home, no VPN): they go through the Companion app's push service.

## 6. Log file (optional)

1. **Add integration → File → Set up a notification service**.
2. File path: `/media/registro_ofertas.txt`. Leave the timestamp off: the automation adds the date.
3. In **Settings → Entities**, open the new entity and change its entity ID to `notify.registro_ofertas`.

The file is created the first time the bot writes to it. If you use the Samba add-on, it's in `\\homeassistant.local\media\`, and [`bajar-registro.bat`](../bajar-registro.bat) copies it to `registro/ofertas.txt` (ignored by git). If you skip this step, the automation still works: the log step is set to continue on error.

## 7. Offers card (optional)

1. Copy [`card/ofertas-card.js`](../card/ofertas-card.js) to `/config/www/ofertas/` (for example through Samba: `\\homeassistant.local\config\www\ofertas\`).
2. **Settings → Dashboards → ⋮ → Resources → Add resource**: URL `/local/ofertas/ofertas-card.js?v=2`, type **JavaScript module**.
3. Add a **Manual** card to the dashboard with [`card/ejemplo-tarjeta.yaml`](../card/ejemplo-tarjeta.yaml), one per person.

When you update the file, raise the number at the end of the resource (`?v=3`…) so the browser doesn't keep the old version.

## 8. Automation

1. **Settings → Automations → Create automation → Edit in YAML**.
2. Paste [`automation/job_alert_bot.yaml`](../automation/job_alert_bot.yaml).
3. Change:
   - the trigger folders, if your labels have other names;
   - the `perfiles` block: each person's list, minimum score, minimum score for offers outside the area, and notify service;
   - every `{# ... #}` block in the prompt (profile, what they're looking for, scoring rules, area and companies to skip). Each comment says what to write there.
4. Save.

## Testing

Mark one or two alert emails in a label as unread. Within a minute the automation should run. If something fails, open the automation's **Traces** to see the email text, the model's answer and the offers that passed the filter, or read the log file.
