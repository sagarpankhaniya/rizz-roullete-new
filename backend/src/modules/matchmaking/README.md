# Matchmaking Module

**Purpose:** Enqueue users, atomically pair them, trigger room creation.

**Why Redis ZSET + Strategy?** FIFO with selective skip, multi-instance safe, filter/premium strategies pluggable.

**Does not:** Talk to LiveKit directly — calls `RoomsService` / `LiveKitService` via injected rooms module.

