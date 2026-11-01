# 0001. Satang Integer Fixed-Point Arithmetic

All financial rates, add-on fees, taxes, and total reservation prices are stored, computed, and transmitted as 64-bit integer Satang (100 Satang = 1.00 THB) rather than floating-point numbers. This eliminates IEEE 754 precision drift during multi-day duration multiplication, 7% VAT calculations, and aggregation sums, guaranteeing deterministic accounting across all service boundaries.
