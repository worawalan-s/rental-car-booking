const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    _postman_id: "8c7d6e5a-1b2c-4f3e-9a8b-123456789abc",
    name: "Rental Car Booking Platform - Stage 1 & 2 Verification Suite",
    description: "Course-aligned automated API verification for Rental Car Booking Platform (Stage 1 & Stage 2). Covers Auth, Cars CRUD, Faceted Search (<200ms), Satang Pricing Engine (<100ms), 3-Car Quota Enforcement, Invariant 5 Schedule Collision, and Cascade Hard Delete.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "00-Health",
      item: [
        {
          name: "Health Check",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Response is standard success envelope', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/health",
              host: ["{{URL}}"],
              path: ["api", "v1", "health"]
            }
          }
        }
      ]
    },
    {
      name: "01-Auth",
      item: [
        {
          name: "Login as Admin",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns JWT token and success envelope', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.token).to.be.a('string');",
                  "    pm.environment.set('ADMIN_TOKEN', jsonData.token);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{ADMIN_EMAIL}}",
                password: "{{ADMIN_PASSWORD}}"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/auth/login",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "login"]
            }
          }
        },
        {
          name: "Login as User",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns JWT token and success envelope', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.token).to.be.a('string');",
                  "    pm.environment.set('USER_TOKEN', jsonData.token);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "{{USER_EMAIL}}",
                password: "{{USER_PASSWORD}}"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/auth/login",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "login"]
            }
          }
        },
        {
          name: "Get Me (Authenticated User)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns current user profile', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data.email).to.eql(pm.environment.get('USER_EMAIL'));",
                  "    pm.expect(jsonData.data.role).to.eql('user');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{USER_TOKEN}}"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/auth/me",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "me"]
            }
          }
        },
        {
          name: "Logout User (Clear Session Cookie)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Clears auth token cookie', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/auth/logout",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "logout"]
            }
          }
        },
        {
          name: "Get Me (Unauthorized - Missing Token)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 401 Unauthorized', function () {",
                  "    pm.response.to.have.status(401);",
                  "});",
                  "pm.test('Standard two-key failure envelope { success: false, message }', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/auth/me",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "me"]
            }
          }
        },
        {
          name: "Get Me (Unauthorized - Invalid Token)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 401 Unauthorized', function () {",
                  "    pm.response.to.have.status(401);",
                  "});",
                  "pm.test('Standard failure envelope { success: false, message }', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer invalid_or_expired_jwt_token"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/auth/me",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "me"]
            }
          }
        },
        {
          name: "Register New User (No Privilege Escalation - Invariant 3)",
          event: [
            {
              listen: "prerequest",
              script: {
                type: "text/javascript",
                exec: [
                  "const uniqueId = Date.now().toString().slice(-6);",
                  "pm.environment.set('NEW_USER_EMAIL', 'test_user_' + uniqueId + '@rentaltest.com');"
                ]
              }
            },
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 or 201', function () {",
                  "    pm.expect([200, 201]).to.include(pm.response.code);",
                  "});",
                  "pm.test('Role must remain user even if admin was submitted (Invariant 3)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    if (jsonData.data && jsonData.data.role) {",
                  "        pm.expect(jsonData.data.role).to.eql('user');",
                  "    }",
                  "    if (jsonData.token) {",
                  "        pm.environment.set('NEW_USER_TOKEN', jsonData.token);",
                  "    }",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Customer Verified",
                email: "{{NEW_USER_EMAIL}}",
                password: "securepassword123",
                tel: "0891234567",
                role: "admin"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/auth/register",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "register"]
            }
          }
        },
        {
          name: "Register with Invalid Thai Phone (Invariant 2 - 400)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 400 Bad Request', function () {",
                  "    pm.response.to.have.status(400);",
                  "});",
                  "pm.test('Rejects invalid phone format', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Invalid Phone User",
                email: "invalid_phone@rentaltest.com",
                password: "password123",
                tel: "12345"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/auth/register",
              host: ["{{URL}}"],
              path: ["api", "v1", "auth", "register"]
            }
          }
        }
      ]
    },
    {
      name: "02-Cars-and-Search",
      item: [
        {
          name: "Get All Cars (Public)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns cars array and captures CAR_ID & PROVIDER_ID', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data).to.be.an('array').that.is.not.empty;",
                  "    const firstCar = jsonData.data[0];",
                  "    pm.environment.set('CAR_ID', firstCar._id);",
                  "    const providerId = typeof firstCar.provider === 'object' ? firstCar.provider._id : firstCar.provider;",
                  "    pm.environment.set('PROVIDER_ID', providerId);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/cars",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars"]
            }
          }
        },
        {
          name: "Get Single Car by ID",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Validates car details and Satang integer rate (Invariant 1)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data._id).to.eql(pm.environment.get('CAR_ID'));",
                  "    pm.expect(Number.isInteger(jsonData.data.dailyRate)).to.be.true;",
                  "    pm.expect(jsonData.data.dailyRate).to.be.at.least(1);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/cars/{{CAR_ID}}",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars", "{{CAR_ID}}"]
            }
          }
        },
        {
          name: "Search Cars - Facet Aggregation (<200ms SLA - Task 4)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Response time is reasonable (<500ms)', function () {",
                  "    pm.expect(pm.response.responseTime).to.be.below(500);",
                  "});",
                  "pm.test('Returns aggregated category facets', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data).to.be.an('array');",
                  "    pm.expect(jsonData.categoryCounts).to.be.an('object');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/cars/search?category=Sedan",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars", "search"],
              query: [
                {
                  key: "category",
                  value: "Sedan"
                }
              ]
            }
          }
        },
        {
          name: "Create Car as Standard User (Forbidden 403)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 403 Forbidden', function () {",
                  "    pm.response.to.have.status(403);",
                  "});",
                  "pm.test('Standard error envelope { success: false, message }', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                brand: "UnauthorizedBrand",
                model: "HackerSedan",
                category: "Sedan",
                dailyRate: 150000,
                capacity: 5,
                provider: "{{PROVIDER_ID}}"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/cars",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars"]
            }
          }
        },
        {
          name: "Create Car as Admin (201 Created)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Creates car and captures CREATED_CAR_ID', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data._id).to.be.a('string');",
                  "    pm.expect(jsonData.data.dailyRate).to.eql(180000);",
                  "    pm.environment.set('CREATED_CAR_ID', jsonData.data._id);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{ADMIN_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                brand: "Tesla",
                model: "Model 3 Long Range Postman",
                category: "Electric",
                dailyRate: 180000,
                capacity: 5,
                provider: "{{PROVIDER_ID}}"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/cars",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars"]
            }
          }
        },
        {
          name: "Update Car as Admin (200 OK)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Updates dailyRate in Satang', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data.dailyRate).to.eql(195000);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "PUT",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{ADMIN_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                dailyRate: 195000
              })
            },
            url: {
              raw: "{{URL}}/api/v1/cars/{{CREATED_CAR_ID}}",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars", "{{CREATED_CAR_ID}}"]
            }
          }
        }
      ]
    },
    {
      name: "03-Pricing-Engine",
      item: [
        {
          name: "Calculate Pricing with Satang Arithmetic (<100ms SLA - Task 5)",
          event: [
            {
              listen: "prerequest",
              script: {
                type: "text/javascript",
                exec: [
                  "const today = new Date();",
                  "const addDays = (days) => new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];",
                  "pm.environment.set('PRICING_START_DATE', addDays(10));",
                  "pm.environment.set('PRICING_END_DATE', addDays(13));"
                ]
              }
            },
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Response time is reasonable (<500ms)', function () {",
                  "    pm.expect(pm.response.responseTime).to.be.below(500);",
                  "});",
                  "pm.test('Integer Satang arithmetic with 7% VAT rounding (Invariant 1)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    const data = jsonData.data;",
                  "    pm.expect(Number.isInteger(data.subtotal)).to.be.true;",
                  "    pm.expect(Number.isInteger(data.vat)).to.be.true;",
                  "    pm.expect(Number.isInteger(data.total)).to.be.true;",
                  "    pm.expect(data.total).to.eql(data.subtotal + data.vat);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CAR_ID}}",
                startDate: "{{PRICING_START_DATE}}",
                endDate: "{{PRICING_END_DATE}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/pricing/calculate",
              host: ["{{URL}}"],
              path: ["api", "v1", "pricing", "calculate"]
            }
          }
        },
        {
          name: "Calculate Pricing Invalid Date Order (400 Bad Request)",
          event: [
            {
              listen: "prerequest",
              script: {
                type: "text/javascript",
                exec: [
                  "const today = new Date();",
                  "const addDays = (days) => new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];",
                  "pm.environment.set('INVALID_START_DATE', addDays(15));",
                  "pm.environment.set('INVALID_END_DATE', addDays(10));"
                ]
              }
            },
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 400 Bad Request', function () {",
                  "    pm.response.to.have.status(400);",
                  "});",
                  "pm.test('Rejects return date before start date', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CAR_ID}}",
                startDate: "{{INVALID_START_DATE}}",
                endDate: "{{INVALID_END_DATE}}"
              })
            },
            url: {
              raw: "{{URL}}/api/v1/pricing/calculate",
              host: ["{{URL}}"],
              path: ["api", "v1", "pricing", "calculate"]
            }
          }
        }
      ]
    },
    {
      name: "04-AddOns",
      item: [
        {
          name: "Get Add-Ons (Public)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns add-ons and captures ADDON_ID', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data).to.be.an('array');",
                  "    if (jsonData.data.length > 0) {",
                  "        pm.environment.set('ADDON_ID', jsonData.data[0]._id);",
                  "    }",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/addons",
              host: ["{{URL}}"],
              path: ["api", "v1", "addons"]
            }
          }
        }
      ]
    },
    {
      name: "05-Bookings-and-Quota",
      item: [
        {
          name: "Create 1st Booking (New User - Valid 201)",
          event: [
            {
              listen: "prerequest",
              script: {
                type: "text/javascript",
                exec: [
                  "const today = new Date();",
                  "const addDays = (days) => new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];",
                  "",
                  "pm.environment.set('DATE_D10', addDays(10));",
                  "pm.environment.set('DATE_D12', addDays(12));",
                  "pm.environment.set('DATE_D11', addDays(11));",
                  "pm.environment.set('DATE_D13', addDays(13));",
                  "pm.environment.set('DATE_D14', addDays(14));",
                  "pm.environment.set('DATE_D20', addDays(20));",
                  "pm.environment.set('DATE_D22', addDays(22));",
                  "pm.environment.set('DATE_D30', addDays(30));",
                  "pm.environment.set('DATE_D32', addDays(32));"
                ]
              }
            },
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Captures BOOKING_1_ID', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data._id).to.be.a('string');",
                  "    pm.environment.set('BOOKING_1_ID', jsonData.data._id);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CREATED_CAR_ID}}",
                startDate: "{{DATE_D10}}",
                endDate: "{{DATE_D12}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Schedule Collision Prevention (Invariant 5 - 400 Overlap)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 400 Bad Request', function () {",
                  "    pm.response.to.have.status(400);",
                  "});",
                  "pm.test('Rejects overlapping schedule for same vehicle (Invariant 5)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.match(/overlap|collision|already reserved/i);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CREATED_CAR_ID}}",
                startDate: "{{DATE_D11}}",
                endDate: "{{DATE_D13}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Adjacent Handover Date (Invariant 5 - Valid 201)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Allows contiguous adjacent handover (startDate == previous endDate)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.environment.set('BOOKING_2_ID', jsonData.data._id);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CREATED_CAR_ID}}",
                startDate: "{{DATE_D12}}",
                endDate: "{{DATE_D14}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Fill 3-Car Quota (Booking 3 - Valid 201)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Successfully reaches exactly 3 active cars quota', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.environment.set('BOOKING_3_ID', jsonData.data._id);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CAR_ID}}",
                startDate: "{{DATE_D20}}",
                endDate: "{{DATE_D22}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Enforce 3-Car Quota Limit (Invariant 4 - 400 Exceeded)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 400 Bad Request', function () {",
                  "    pm.response.to.have.status(400);",
                  "});",
                  "pm.test('Rejects 4th active car for standard user (Invariant 4)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.match(/maximum quota of 3 cars/i);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json"
              },
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                car: "{{CAR_ID}}",
                startDate: "{{DATE_D30}}",
                endDate: "{{DATE_D32}}",
                numOfCars: 1
              })
            },
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Get User Bookings (200 OK)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns active user bookings', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data).to.be.an('array');",
                  "    pm.expect(jsonData.data.length).to.be.at.least(3);",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        },
        {
          name: "Get All Bookings as Admin (200 OK)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Admin sees system-wide bookings', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "    pm.expect(jsonData.data).to.be.an('array');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{ADMIN_TOKEN}}"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/bookings",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings"]
            }
          }
        }
      ]
    },
    {
      name: "06-Cleanup-and-Cascade",
      item: [
        {
          name: "Delete Single Booking as User (200 OK)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Successfully deletes user booking', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "DELETE",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{NEW_USER_TOKEN}}"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/bookings/{{BOOKING_3_ID}}",
              host: ["{{URL}}"],
              path: ["api", "v1", "bookings", "{{BOOKING_3_ID}}"]
            }
          }
        },
        {
          name: "Cascade Delete Car as Admin (Invariant 7 - 200 OK)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Hard deletes vehicle and cascades to associated bookings (Invariant 7)', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.true;",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "DELETE",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{ADMIN_TOKEN}}"
              }
            ],
            url: {
              raw: "{{URL}}/api/v1/cars/{{CREATED_CAR_ID}}",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars", "{{CREATED_CAR_ID}}"]
            }
          }
        },
        {
          name: "Verify Deleted Car (404 Not Found)",
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 404 Not Found', function () {",
                  "    pm.response.to.have.status(404);",
                  "});",
                  "pm.test('Standard two-key error envelope { success: false, message }', function () {",
                  "    const jsonData = pm.response.json();",
                  "    pm.expect(jsonData.success).to.be.false;",
                  "    pm.expect(jsonData.message).to.be.a('string');",
                  "});"
                ]
              }
            }
          ],
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{URL}}/api/v1/cars/{{CREATED_CAR_ID}}",
              host: ["{{URL}}"],
              path: ["api", "v1", "cars", "{{CREATED_CAR_ID}}"]
            }
          }
        }
      ]
    }
  ]
};

const outputPath = path.join(__dirname, '..', 'postman', 'rental-car-stage1-2.collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');
console.log('Postman Collection generated successfully at: ' + outputPath);
