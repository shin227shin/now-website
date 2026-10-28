# now-website

Status site for Claude Code on Earth. See `README.md` for how the site works.

## ⚠️ MUST FOLLOW: Pull Request rule

**NEVER commit or push directly to `main`.** Every change goes through a Pull Request.

1. Run `git switch main` and `git pull` first, so you start from the latest version.
2. Create a branch with a clear name: `git switch -c fix/globe-pin` or `git switch -c feat/past-sessions`.
3. Make the change and commit it on that branch.
4. Push the branch (`git push -u origin <branch>`) and open a Pull Request.
5. Open the Netlify deploy preview in the Pull Request and check that nothing is broken.
6. Merge the Pull Request, delete the branch, then run `git switch main` and `git pull`.

### Rules

- **Do not push to `main`**, even if GitHub allows it. The branch rule is not enforced on this private repository, so this rule is only kept by us.
- **Never use `git push --force`.**
- If you are on `main` when asked to change something, create a branch first.
- Do not merge a Pull Request yourself unless the user says so. Ask the user to merge, or ask first.
- If a push is rejected, run `git pull` and try again. Do not force it.

### Ask the other person first when

- You change `index.html` or `assets/style.css` in a big way.
- The other person may be working on the same file.
- The look of the public site changes a lot.

## Admin page content is not in Git

Content edited on `/admin` is saved in Netlify Blobs, not in Git. A branch or Pull Request does not protect it. Use **History** on the admin page to restore an older version. `data/default-content.json` is only the starting content before the first save.
