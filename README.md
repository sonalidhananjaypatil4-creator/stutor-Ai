# Show Your Work First

A patient AI-tutoring study tool for students that only provides help (hints and explanations) after they have attempted to solve the problem themselves by writing at least 25 characters of trimmed, genuine attempt text.

## Features
- **Notebook Exercise Styled UI**: Stylized Ruled notebook format using authentic fonts (Kalam, Work Sans, and IBM Plex Mono).
- **Anti-Cheat Lock Gate**: Disables help button until 25 characters of non-trivial, non-repetition attempt are inputted.
- **Visual Validation Stamp**: Renders a vintage green "ATTEMPTED ✓" rubber stamp when the input requirement is met.
- **Tutor Hints / Step-by-Step Explanations**: Proxied requests to Google's Gemini API using the `gemini-3.5-flash` model.
- **Input Guard**: Rejects queries exceeding 4000 combined characters.

## Installation & Setup

1. **Install Node.js Dependencies**:
   Navigate to the root directory of the project and run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy the example environment file and add your Gemini credentials (obtain an API key from [Google AI Studio](https://aistudio.google.com)):
   ```bash
   cp .env.example .env
   ```
   Open `.env` and assign your API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   PORT=3000
   ```

3. **Start the Express Server**:
   Launch the backend server (which also hosts the frontend UI under `/public`):
   ```bash
   npm start
   ```

4. **Access the App**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Deploying to Render

1. **Push your project to GitHub** — make sure `.env` and `node_modules/` are in `.gitignore` (they are already). Never commit your real `GEMINI_API_KEY`.

2. **Create a new Web Service** on [render.com](https://render.com):
   - Sign in → **New** → **Web Service**
   - Connect the GitHub repository that contains this project
   - Render will detect `render.yaml` automatically and pre-fill the settings

3. **Set your API key** in Render's environment variables:
   - In the Render dashboard, go to your service → **Environment**
   - Add a new variable: `GEMINI_API_KEY` = *(your key from [aistudio.google.com](https://aistudio.google.com))*

4. **Deploy** — click **Deploy** (or push a new commit). Render runs `npm install` then `npm start`. The server reads `process.env.PORT` automatically.

5. **Access the live URL** Render provides (e.g. `https://show-your-work-first.onrender.com`).

> **Note**: Render's free tier spins down after inactivity. The first request after sleep may take ~30 seconds. For a classroom prototype this is fine; upgrade to a paid instance if you need always-on.
