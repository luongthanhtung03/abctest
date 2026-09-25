# 06 · Mô hình dữ liệu

## Mục đích

Tài liệu này mô tả các bảng dữ liệu. Mô hình được giữ **tối giản để dễ demo**: 6 bảng, chỉ dùng những ràng buộc bảo vệ tính đúng đắn.

## Sơ đồ ER

```mermaid
erDiagram
    users ||--o{ quotes : "tạo"
    customers ||--o{ quotes : "có"
    quotes ||--o{ quote_events : "lịch sử"
    quotes |o--o| quotes : "thay thế (doc only)"

    users {
        string id PK
        string email UK
        string name
        string password_hash
        string role "sales | admin"
    }
    customers {
        string id PK
        string code
        string name
        string tax_code
        string address
        string contact_name
        string phone
        string email
    }
    products {
        string id PK
        string sku
        string name
        string spec
        string unit
        int list_price "VND"
    }
    quotes {
        string id PK
        string quote_no UK "BG-2026-0001"
        string customer_id FK
        string created_by FK
        string status "PENDING|PROCESSING|COMPLETED|FAILED"
        string idempotency_key UK
        string template_version
        json payload "snapshot đóng băng"
        bigint total "để hiển thị danh sách"
        int attempts
        datetime next_run_at
        string locked_by
        datetime locked_until
        string error_code
        string error_message
        string file_key "quotes/2026/BG-2026-0001.docx"
        int file_size
        datetime created_at
        datetime completed_at
    }
    quote_events {
        string id PK
        string quote_id FK
        string type
        string from_status
        string to_status
        string actor "user:<id> | agent | system"
        string message
        datetime created_at
    }
    agents {
        string id PK
        datetime last_seen_at
    }
```

`products` không có quan hệ khoá ngoại với `quotes`, vì thông tin sản phẩm đã được **chép vào snapshot** tại thời điểm gửi.

## Quyết định và lý do

| Quyết định | Lý do | Đánh đổi |
|---|---|---|
| **Các dòng sản phẩm nằm trong `payload` (JSON)**, không có bảng `quote_items` | Snapshot không bao giờ bị sửa, luôn được đọc nguyên khối, không cần join | Khó làm báo cáo kiểu "báo giá nào có NaOH". Khi cần thì thêm `quote_items` |
| **Không có bảng `jobs` riêng**. Các trường của job nằm ngay trên `quotes` | Một báo giá tương ứng một job. Mỗi lần retry là một lần thử trên cùng dòng dữ liệu | `quote_events` đã ghi lại lịch sử từng lần thử |
| **Chỉ 5 loại ràng buộc**: PK, FK, `quote_no` UNIQUE, `idempotency_key` UNIQUE, `email` UNIQUE | Đủ để bảo vệ tính đúng đắn. Ràng buộc UNIQUE trên idempotency key là thứ làm cho chống gửi trùng hoạt động | Trạng thái là text và được validate trong code |
| **Tiền lưu bằng số nguyên VND** | Không có sai số dấu phẩy động | — |
| **`file_key` là đường dẫn tương đối** | Dùng được cho cả local và S3 mà không cần migrate dữ liệu | — |
| `quote_no` tự sinh từ sequence và năm | Đơn giản, không trùng | Số thứ tự không reset theo năm (chấp nhận được) |
| Trường Doc only (`ai_result`, `replaces_quote_id`, `cancel_reason`, `file_sha256`) **không tạo** trong prototype | Giữ schema gọn để demo | Thêm bằng một migration khi triển khai các tính năng đó |

## Trong prototype

**Built:** 6 bảng như sơ đồ, Prisma migration và seed (3 khách hàng, 6 sản phẩm, 3 tài khoản `sales.a`, `sales.b`, `admin`).
