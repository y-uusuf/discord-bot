import os
import subprocess
import sys

def clear():
    os.system('cls' if os.name == 'nt' else 'clear')

def run_cmd(cmd):
    """Run a command and return success status"""
    result = subprocess.run(cmd, shell=True)
    return result.returncode == 0

def push_with_commit():
    """Option 1: Git push with commit message"""
    clear()
    msg = input("Enter commit message: ").strip()
    if not msg:
        print("Commit message cannot be empty.")
        input("Press Enter to continue...")
        return
    
    run_cmd("git add -A")
    run_cmd(f'git commit -m "{msg}"')
    run_cmd("git push")
    print("\nDone!")
    input("Press Enter to continue...")

def clone_current():
    """Option 2: Clone the current repo to this folder"""
    clear()
    # Get remote URL
    result = subprocess.run("git remote get-url origin", shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print("Failed to get remote URL. Make sure you're in a git repository.")
        input("Press Enter to continue...")
        return
    
    remote_url = result.stdout.strip()
    
    # Delete current folder contents except .git and node_modules
    print(f"Cloning from: {remote_url}")
    
    # Fetch latest and reset hard
    run_cmd("git fetch origin")
    run_cmd("git reset --hard origin/main")
    run_cmd("git clean -fd")
    
    print("\nDone! Synced to latest remote.")
    input("Press Enter to continue...")

def clone_specific_commit():
    """Option 3: Clone a specific commit"""
    clear()
    commit_hash = input("Enter commit hash: ").strip()
    if not commit_hash:
        print("Commit hash cannot be empty.")
        input("Press Enter to continue...")
        return
    
    run_cmd("git fetch origin")
    success = run_cmd(f"git reset --hard {commit_hash}")
    if success:
        print(f"\nDone! Reset to commit: {commit_hash}")
    else:
        print(f"\nFailed to reset to commit: {commit_hash}")
    input("Press Enter to continue...")

def main():
    while True:
        clear()
        print("[1] Push & Commit")
        print("[2] Sync to latest")
        print("[3] Reset to specific commit")
        print("[4] Exit")
        print()
        
        choice = input("yusuf@dev ~ ").strip()
        
        if choice == "1":
            push_with_commit()
        elif choice == "2":
            clone_current()
        elif choice == "3":
            clone_specific_commit()
        elif choice == "4":
            clear()
            sys.exit(0)
        else:
            print("Invalid option.")
            input("Press Enter to continue...")

if __name__ == "__main__":
    main()
