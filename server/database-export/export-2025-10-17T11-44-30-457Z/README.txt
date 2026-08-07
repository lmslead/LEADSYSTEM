
DATABASE EXPORT COMPLETED
=========================

Export Date: 2025-10-17T11:44:31.434Z
Export Path: C:\Users\int0003\desktop\new folder\LEADSYSTEM\server\database-export\export-2025-10-17T11-44-30-457Z

Files Created:
- users.json (45 records)
- organizations.json (2 records) 
- leads.json (1385 records)
- export-summary.json (metadata)

TO IMPORT TO NEW DATABASE:
1. Update your .env file with new database URI
2. Run: node import-database.js export-2025-10-17T11-44-30-457Z

IMPORTANT NOTES:
- All passwords are included in the export
- ObjectIds will be preserved to maintain relationships
- Ensure new database is empty before importing
- Keep this export secure as it contains sensitive data
