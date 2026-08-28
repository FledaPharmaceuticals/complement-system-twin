# Fleda GitHub Publish Checklist

This project is independent from every GN system. Publish it only under the
Fleda Pharmaceuticals GitHub account or organization.

## Before Publishing

1. Create an empty public repository named `complement-system-twin` under the
   Fleda GitHub owner. Do not add a README, license, or `.gitignore` during
   repository creation because this local repository already contains them.
2. Confirm that the repository owner is Fleda Pharmaceuticals.
3. Confirm that no patient, customer, production, `.env`, virtual-environment,
   SQLite, raw snapshot, or local cache files are part of the commit.
4. Run `./scripts/verify-local.sh` and keep its output with the release notes.

## Local Push

From the project directory, replace `<FLEDA_OWNER>` with the exact GitHub
organization or account name:

```sh
git remote add origin git@github.com:<FLEDA_OWNER>/complement-system-twin.git
git push -u origin main
```

Use the Fleda GitHub authentication method configured on the computer. Never
place a password, personal access token, or private key in this repository.

## After Publishing

1. Open the repository's **Actions** tab and confirm that workflows are
   allowed to run.
2. Open **Fleda public literature snapshot** and use **Run workflow** once for
   a controlled smoke run.
3. Confirm the run uses only public PubMed and Europe PMC sources and that its
   artifact is temporary and time-limited.
4. Keep the active model release unchanged. The workflow only creates a
   reviewable literature snapshot; it never promotes calibration candidates.

The final push and workflow run are public repository operations and require
explicit approval at the time they are performed.
