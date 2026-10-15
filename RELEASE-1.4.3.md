# 1.4.3

- Blue and white login, buttons, floating chat and animated orbs. Orb hue cycling is disabled so it stays blue throughout animation. Login branding now reads «امتحانات».
- Ordinary conversation uses a reply-only response schema and receives no bank or exam catalog. Tool instructions and default exam settings are restricted to actual task requests. Unexpected tool actions in ordinary chat are rejected before execution.
- «انت تسمعني» receives a direct explanation that this is text chat, without opening bank cards or claiming microphone capture.
- Includes the question picker/review, Ministry branding, draggable assistant and local speed changes from 1.4.1–1.4.2.

Live checks with loaded qwen3:1.7b: ordinary greeting 1.825 seconds and a short educational reply 3.348 seconds, with no unrelated cards. These measure response time and routing, not factual correctness or cold loading. Small local model explanations still require teacher judgment.
