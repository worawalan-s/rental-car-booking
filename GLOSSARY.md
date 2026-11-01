# Rental Car Booking Platform

Backend RESTful API facilitating vehicle reservations, inventory availability, multi-tenant provider contracts, and quota enforcement.

## Language

**Renter**:
A registered customer account permitted to search vehicles and hold active car reservations.
_Avoid_: Client, buyer, customer, account

**Admin**:
A privileged staff account authorized to manage vehicle fleets, review all bookings, and configure providers.
_Avoid_: Superuser, manager, root

**Provider**:
A registered commercial car rental company operating vehicle fleets and add-on inventory.
_Avoid_: Vendor, agency, company, dealership

**Car**:
A specific physical vehicle owned by a Provider and offered for customer rental.
_Avoid_: Vehicle, automobile, ride

**Vehicle Category**:
The classified body and usage segment of a Car (`Sedan`, `SUV`, `Hatchback`, `Van`, `Truck`, `Luxury`, `Electric`).
_Avoid_: Car type, vehicle class, model tier

**Booking**:
A time-bounded contract between a Renter, a Provider, and a Car for a specified rental duration.
_Avoid_: Order, reservation, appointment

**Active Booking**:
A Booking currently occupying vehicle schedule and quota capacity (`Pending`, `Confirmed`, or `Active` status).
_Avoid_: Ongoing booking, open order

**3-Car Quota**:
The business constraint restricting a single Renter from holding more than 3 cumulative booked cars across all Active Bookings.
_Avoid_: Rental limit, user cap, maximum allowance

**Satang**:
The fractional currency unit equal to 1/100 of a Thai Baht (THB), stored strictly as an integer.
_Avoid_: Cent, decimal price, float Baht

**Schedule Collision**:
A temporal conflict where a requested rental date range overlaps with an existing Active Booking for the same physical Car.
_Avoid_: Double booking, date overlap, scheduling conflict

**Hard Delete**:
The physical deletion of a Booking or resource from the database (`deleteOne()`), immediately freeing quota and schedule slots.
_Avoid_: Logical delete, soft delete, archive

**Add-On**:
An optional auxiliary accessory or service (e.g. Child Safety Seat, GPS Navigation) rented alongside a Car.
_Avoid_: Extra, accessory, upgrade, option

**Allocated Stock**:
The quantity of scarce Add-On physical units currently committed to Active Bookings and unavailable for new reservations.
_Avoid_: Reserved inventory, locked stock, held items
