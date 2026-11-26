---
name: check-order
description: Look up a store order and tell the user whether it is placed, approved or delivered.
---

# Check an order

1. Ask for the order ID if the user has not given one.
2. Call `getOrderById` and report its `status` and `shipDate`.

Never call `deleteOrder` unless the user explicitly asks to cancel the order.
