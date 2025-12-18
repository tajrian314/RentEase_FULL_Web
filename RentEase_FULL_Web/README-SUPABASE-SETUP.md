# Supabase Setup Guide for RentEase

This guide will help you set up Supabase for your RentEase project.

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in your project details:
   - Name: `rentease` (or any name you prefer)
   - Database Password: Create a strong password (save it!)
   - Region: Choose the closest region to your users
5. Click "Create new project" and wait for it to be ready (2-3 minutes)

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Configure Your Project (Using .env)

### Option A: Using .env file (Recommended)

1. Create a `.env` file in your project root (or copy from `.env.example` if it exists)
2. Add your Supabase credentials:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Run the setup script to generate the config:
   ```bash
   node load-env.js
   ```
   Or if you have npm:
   ```bash
   npm run setup
   ```

### Option B: Manual Configuration

1. Open `supabase-config.js` in your project
2. Replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Paste your Project URL here
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Paste your anon key here
   ```

## Step 4: Set Up the Database

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Open the file `database-schema.sql` from this project
4. Copy all the SQL code
5. Paste it into the SQL Editor
6. Click "Run" (or press Ctrl+Enter)
7. Wait for all tables and policies to be created

**Important**: If you get "profile missing" errors after setup, also run `fix-rls-policy.sql` to ensure the INSERT policy exists.

## Step 5: Set Up Storage Bucket

The SQL script should create the storage bucket automatically, but if needed:

1. Go to **Storage** in the Supabase dashboard
2. You should see a bucket named `property-images`
3. If it doesn't exist, create it:
   - Click "New bucket"
   - Name: `property-images`
   - Make it **Public**
   - Click "Create bucket"

## Step 6: Test Your Setup

1. Open `index.html` in your browser
2. Open the browser console (F12)
3. Check for any errors related to Supabase
4. Try signing up a new user
5. Try adding a property (as owner)
6. Check if properties appear on the main page

## Troubleshooting

### "Supabase is not configured" warning
- Make sure you've updated `supabase-config.js` with your credentials
- Check that the Supabase CDN script is loaded in your HTML files

### "Error loading properties"
- Verify your database tables were created successfully
- Check that RLS policies are enabled
- Verify your API keys are correct

### Image upload fails
- Make sure the `property-images` storage bucket exists
- Check that storage policies are set correctly
- Verify the bucket is set to public

### Authentication errors
- Check that the `users` table exists
- Verify RLS policies for the users table
- Make sure email confirmation is disabled in Supabase Auth settings (for testing)

## Disable Email Confirmation (for Development)

1. Go to **Authentication** → **Settings** in Supabase
2. Under "Email Auth", toggle off "Enable email confirmations"
3. This allows users to sign up without email verification (for testing only)

## Security Notes

- Never commit your Supabase keys to public repositories
- The `anon` key is safe to use in client-side code (it's protected by RLS)
- For production, consider using environment variables
- Always use HTTPS in production

## Next Steps

- Customize the database schema if needed
- Add more features (reviews, favorites, etc.)
- Set up email notifications
- Configure custom domain
- Set up backups

## Support

If you encounter issues:
1. Check the Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
2. Check browser console for error messages
3. Verify all SQL scripts ran successfully
4. Ensure your Supabase project is active (not paused)

