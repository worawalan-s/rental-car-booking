# Rental Car Booking Platform: Use Case Diagram

> **Rendered Diagram**: [use_case_diagram.png](./use_case_diagram.png) (Presentation Slide 5)  
> **PlantUML Source**: [use_case_diagram.puml](./use_case_diagram.puml)

```plantuml
@startuml use_case_diagram
skinparam BackgroundColor #0B1120
skinparam roundcorner 12
skinparam shadowing false
skinparam defaultFontName "Helvetica, Arial, sans-serif"
skinparam defaultFontSize 12

skinparam package {
    BackgroundColor #131D31
    BorderColor #334155
    BorderThickness 1.5
    FontColor #94A3B8
    FontSize 13
    FontStyle bold
}

skinparam rectangle {
    BackgroundColor #0F172A
    BorderColor #475569
    BorderThickness 2
    FontColor #38BDF8
    FontSize 15
    FontStyle bold
}

skinparam usecase {
    BackgroundColor #1E293B
    BorderColor #0EA5E9
    BorderThickness 1.8
    FontColor #F8FAFC
    FontSize 11
}

skinparam actor {
    BackgroundColor #1E293B
    BorderColor #38BDF8
    FontColor #38BDF8
    FontSize 13
    FontStyle bold
}

skinparam arrow {
    Color #38BDF8
    Thickness 1.8
    FontColor #94A3B8
    FontSize 10
}

left to right direction

actor "👤 Registered User\n(Renter)" as User #1E293B
actor "👮 Administrator\n(Platform Admin)" as Admin #2A1D0B

rectangle "Rental Car Booking Platform (System Boundary)" {

    package "1. Authentication & Profile" {
        usecase "UC-01: Register Account" as UC_Reg
        usecase "UC-02: Login & Receive JWT" as UC_Login
        usecase "UC-03: Logout & Clear Cookie" as UC_Logout
        usecase "UC-04: Upload Driver License\n(Adv Req 5 - AWS S3)" as UC_UploadDoc #2E1065
    }

    package "2. Catalog, Providers & Pricing" {
        usecase "UC-05: Browse Available Cars" as UC_ViewCars
        usecase "UC-06: Faceted Search & Filtering\n(Adv Req 2 - MongoDB $facet)" as UC_SearchFacet #2E1065
        usecase "UC-07: Browse Rental Providers" as UC_ViewProviders
        usecase "UC-08: Calculate Rental Quote\n(Adv Req 3 - Satang Integer & 7% VAT)" as UC_CalcPrice #2E1065
        usecase "UC-09: Manage Providers\n(Adv Req 1 - Redis Cache Invalidation)" as UC_ManageProviders #3D2605
        usecase "UC-10: Manage Vehicles Catalog" as UC_ManageCars #3D2605
    }

    package "3. Booking Lifecycle & ACID Concurrency" {
        usecase "UC-11: Create Booking\n(Cumulative 3-Car Quota Guard)" as UC_CreateBooking #0C4A6E
        usecase "UC-12: Reserve Add-Ons\n(Adv Req 4 - ACID Pessimistic Lock)" as UC_LockAddon #2E1065
        usecase "UC-13: View Personal Bookings\n(Ownership Scoped)" as UC_ViewOwn
        usecase "UC-14: Cancel Personal Booking\n(Inventory Reclamation)" as UC_CancelOwn
        usecase "UC-15: Supervise Global Bookings" as UC_ViewAll #3D2605
        usecase "UC-16: Update Booking Status\n(State Machine - Adv Req 6)" as UC_UpdateStatus #3D2605
        usecase "UC-17: Hard Delete Any Booking\n(Cascade Deletion)" as UC_DeleteBooking #450A0A
    }

    UC_CreateBooking .> UC_LockAddon : <<include>>
}

' User Associations
User --> UC_Reg
User --> UC_Login
User --> UC_Logout
User --> UC_UploadDoc
User --> UC_ViewCars
User --> UC_SearchFacet
User --> UC_ViewProviders
User --> UC_CalcPrice
User --> UC_CreateBooking #38BDF8
User --> UC_ViewOwn
User --> UC_CancelOwn

' Admin Associations
Admin --> UC_Login #F59E0B
Admin --> UC_Logout #F59E0B
Admin --> UC_ManageProviders #F59E0B
Admin --> UC_ManageCars #F59E0B
Admin --> UC_ViewAll #F59E0B
Admin --> UC_UpdateStatus #F59E0B
Admin --> UC_DeleteBooking #EF4444

@enduml
```
