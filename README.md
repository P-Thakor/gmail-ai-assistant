# Gmail AI Assistant

Automated email reply assistant powered by Google Gemini AI, built with **Next.js**, **TypeScript**, **OAuth**, and integrated with the **Gmail API**.

---

## 🚀 Features

- Fetches and displays user emails using Gmail API.
- Generates AI-powered replies using Google's Gemini API.
- Filters spam and automated emails using configurable ignore patterns.
- Categorizes emails into different types (e.g., interested, not interested).
- Sends replies and applies Gmail labels automatically.
- Supports periodic mail checks and rate limiting.

---

## 🧰 Tech Stack

- **Frontend**: Next.js, TypeScript, React
- **Backend**: Next.js API Routes (Node.js)
- **AI**: Google Gemini API
- **Authentication**: OAuth 2.0 with Gmail
- **Storage**: JSON-based config and token storage

---

## env file

```bash
GEMINI_API_KEY=your_gemini_api_key
```

---

## ⚙️ Server Start

### Clone the Repository and Run the server

```bash
git clone https://github.com/P-Thakor/gmail-ai-assistant.git
cd gmail-ai-assistant
```

```bash
cd gmail-ai.assistant
npm install
```

```bash
npm run dev
```
