# 0003. Hard Delete and Cascade Lifecycle

Bookings and entity records are physically removed from MongoDB (`deleteOne()` / `deleteMany()`) upon deletion, strictly adhering to the instructor's VacQ course architecture and autograding expectations. When a Car is removed, associated reservations are cascade-deleted immediately, freeing quota and vehicle schedule slots without introducing custom soft-delete flags that deviate from standard course evaluation scripts.
