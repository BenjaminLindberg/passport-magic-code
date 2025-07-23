# 🔐 passport-magic-code

A flexible, plug-and-play Passport strategy for **passwordless login**, registration, and callback-based authentication using magic codes (OTP-like).

Built with:

- ✅ **TypeScript** and **Zod** for validation and type-safety
- ⚡️ Customizable storage (in-memory, database, etc.)
- 📬 Pluggable logic for sending and processing codes
- 🧠 Simple interface that handles login, registration, and callbacks

---

## ⚠️ Zod Compatibility Notice

- Version `^1.0.0` uses **Zod v3**
- Version `^2.0.0` and later uses **Zod v4**

---

## 📦 Install

```bash
npm install passport-magic-code
```

---

## ✨ Features

- 🔒 Magic code authentication (e.g. 6-digit OTP via email or SMS)
- 📬 Bring your own code delivery function (email, SMS, etc.)
- 🧠 Validates schema and logic with `zod`
- ⚙️ Works with any Express-based app using `passport`
- ⏳ Code expiration and single-use handling

---

## 🚀 Usage Example

```ts
import { Strategy as MagicCodeStrategy } from "passport-magic-code";
import { v4 as uuidv4 } from "uuid";

const magicCode = new MagicCodeStrategy(
  {
    secret: process.env.MAGIC_CODE_SECRET,
    codeLength: 6,
    userPrimaryKey: "email",
    codeField: "code",
    expiresIn: 15, // minutes
    storage: {
      codes: {},
      set: async (key, value) => {
        await db.otps.create({ code: key, value });
      },
      get: async (key) => {
        return (await db.otps.findOne({ code: key }))?.value;
      },
      delete: async (key) => {
        await db.otps.deleteOne({ code: key });
      },
    },
  },
  // sendCode(user, code, options)
  async ({ email, ...user }, code, { action }) => {
    const existingUser = await db.users.findOne({ email });

    if (action === "login" && !existingUser) return;

    if (action === "register" && (existingUser || !email)) {
      return {
        error: "User already exists",
        statusCode: 400,
      };
    }

    await sendEmail({
      to: email,
      subject: "Your Login Code",
      html: `<p>Your code is: <strong>${code}</strong></p>`,
    });
  },
  // callback(user, options)
  async ({ email, ...user }) => {
    let account = await db.users.findOne({ email });

    if (!account) {
      account = await db.users.create({
        id: uuidv4(),
        email,
        ...user,
        createdAt: new Date(),
      });

      await db.orgs.create({
        uid: account.id,
        id: "personal",
        profile: {
          name: "Personal",
          description: "Your default organization",
        },
      });
    }

    return account;
  }
);
```

---

## 🧩 Configuration

### Required Args

| Option           | Type            | Default | Description                                 |
| ---------------- | --------------- | ------- | ------------------------------------------- |
| `secret`         | `string`        | –       | Secret used internally (min 16 chars)       |
| `codeLength`     | `number`        | `4`     | Length of the OTP code                      |
| `storage`        | `MemoryStorage` | –       | Your code storage interface (see below)     |
| `expiresIn`      | `number`        | `30`    | Minutes until code expires                  |
| `userPrimaryKey` | `string`        | `email` | Field used to identify the user             |
| `codeField`      | `string`        | `code`  | Field to look for code in body/query/params |

---

## 📦 Storage Interface

Implement a `MemoryStorage` object like so:

```ts
const storage = {
  codes: {},

  async set(key, value) {
    // Save to DB or in-memory store
  },

  async get(key) {
    // Return the stored value
  },

  async delete(key) {
    // Delete the key after it's used
  },
};
```

---

## 🛠 `sendCode(user, code, options)`

Use this function to send the generated code to the user via:

- 📧 Email
- 📱 SMS
- 🔔 Push notification

This function is **called during login/register actions**.

---

## 🔄 `callback(user, options)`

This is where you:

- Lookup or create the user
- Return the user object to `passport`
- Attach session or token logic as needed

This function is **called when the user submits the correct code**.

---

## 🔐 API

### Actions (`options.action`)

- `"login"`: Login flow (fail silently if user not found)
- `"register"`: Register flow (fail if user exists or info is incomplete)
- `"callback"`: Validate code and complete login

### Strategy Usage

```ts
passport.use("magic-code", magicCode);

app.post(
  "/auth/send",
  passport.authenticate("magic-code", { action: "login" })
);
app.post(
  "/auth/callback",
  passport.authenticate("magic-code", { action: "callback" })
);
```

---

## 🧪 Development

- Built in TypeScript
- Schema validation with Zod
- Fully type-safe, async/await-first

---

## 📜 License

MIT © 2025
