# 1. Clone the repository to your local machine (if you haven't already)
git clone <your-repo-url>
cd <your-repo-name>

# 2. Make sure you are on your default branch (e.g., main or master)
git checkout main

# 3. Recursively remove all files and folders
git rm -r .

# 4. Commit the changes
git commit -m "Remove all files and folders to clear repository"

# 5. Push the changes back to GitHub
git push origin main
