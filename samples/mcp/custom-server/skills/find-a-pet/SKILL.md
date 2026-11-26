---
name: find-a-pet
description: Find pets that match what the user is looking for and show their details.
---

# Find a pet

1. Call `findPetsByStatus` with `status: available` unless the user asks for sold or pending pets.
2. Narrow the result with `findPetsByTags` when the user names a tag.
3. Call `getPetById` for each pet you present, so the details are current.

Never call `deletePet` or `updatePetWithForm` while helping the user search.
