# Rental Car Booking Platform: UML Class Diagram

```mermaid
classDiagram
    direction TB

    class User {
        +ObjectId _id
        +String name
        +String tel
        +String email
        +String role
        +String password
        +Object driverLicense
        +matchPassword(enteredPassword) Boolean
        +getSignedJwtToken() String
    }

    class Provider {
        +ObjectId _id
        +String name
        +String address
        +String tel
        +Date createdAt
        +Car[] cars_virtual
    }

    class Car {
        +ObjectId _id
        +String brand
        +String model
        +String category
        +Number dailyRate_Satang
        +Number capacity
        +Boolean isAvailable
        +ObjectId provider
        +Date createdAt
        +Booking[] bookings_virtual
    }

    class Booking {
        +ObjectId _id
        +ObjectId user
        +ObjectId car
        +ObjectId provider
        +Date startDate
        +Date endDate
        +Number numOfCars
        +String status
        +String paymentStatus
        +Number totalPrice_Satang
        +BookingAddOn[] addOns
        +Date createdAt
    }

    class AddOn {
        +ObjectId _id
        +String name
        +String category
        +Number dailyRate_Satang
        +Number inventoryStock
        +Number allocatedStock
        +Number availableStock
        +Boolean isAvailable
        +ObjectId provider
        +Date createdAt
    }

    class BookingAddOn {
        +ObjectId addOn
        +Number quantity
        +Number price_Satang
    }

    %% Relationships
    Provider "1" *-- "0..*" Car : owns
    Provider "1" *-- "0..*" AddOn : stocks
    User "1" --> "0..*" Booking : places
    Car "1" --> "0..*" Booking : reserved_for
    Provider "1" --> "0..*" Booking : fulfills
    Booking "1" *-- "0..*" BookingAddOn : attaches
    BookingAddOn "1" --> "1" AddOn : references
```
