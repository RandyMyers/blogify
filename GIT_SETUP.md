# Git Setup Guide for Server

## Quick Setup Commands

### Option 1: Initialize Git in Server Directory (Recommended)

```bash
# Navigate to server directory
cd server

# Initialize git (if not already initialized)
git init

# Add remote repository
git remote add origin https://github.com/RandyMyers/blogify.git

# Add all files
git add .

# Commit files
git commit -m "Initial commit: Server files"

# Push to GitHub
git push -u origin main
```

If your default branch is `master` instead of `main`:

```bash
git push -u origin master
```

---

### Option 2: If Repository Already Exists

```bash
cd server

# Check current status
git status

# If remote exists, verify it
git remote -v

# If wrong remote, update it
git remote set-url origin https://github.com/RandyMyers/blogify.git

# Add and commit
git add .
git commit -m "Update server files"

# Push
git push -u origin main
```

---

## Important: Environment Variables

**DO NOT commit `.env` file!**

The `.gitignore` file is configured to exclude:
- ✅ `.env` files
- ✅ `node_modules/`
- ✅ Log files
- ✅ Sensitive data

### Create `.env.example` for Documentation

You may want to create a `.env.example` file (without actual values) to document required environment variables:

```bash
# .env.example
MONGO_URL=mongodb://localhost:27017/blogify
JWT_SECRET=your-secret-key-here-minimum-32-characters
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLIENT_URL=https://your-client-url.com
ADMIN_URL=https://your-admin-url.com
NODE_ENV=production
PORT=5000
```

---

## Verification

After pushing, verify on GitHub:
1. Go to https://github.com/RandyMyers/blogify
2. Check that files are uploaded
3. Verify `.env` is NOT in the repository

---

## Branch Strategy

For production deployments, consider:

```bash
# Main branch for production code
git checkout -b main

# Development branch
git checkout -b develop

# Feature branches
git checkout -b feature/your-feature-name
```
