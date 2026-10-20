# Episode milestone deployment worksheet
#
# Do not save your real private key in this file. In PowerShell, replace the
# placeholder only in the command you run, then close that terminal afterward.

$env:EPISODE_PRIVATE_KEY = "PASTE_KEY_IN_TERMINAL_ONLY"
$env:EPISODE_CONTRACT = "0x9e6985b530A0c422E876C773b2d8b4e58E20b4f5"

# Choose deliberately: 1..10000 basis points. For example, 8800 means an
# 88.00% semantic-similarity threshold before a filing is flagged for review.
$env:EPISODE_INTEGRITY_THRESHOLD_BPS = "CHOOSE_1_TO_10000"

npm run deploy:milestone
