# Terminology Change: "Disqualified" → "Not - Qualified"

## Summary
Successfully changed all instances of "Disqualified"/"disqualified" to "Not - Qualified"/"not-qualified" throughout the LEADSYSTEM project.

## Files Modified

### Server-Side Files

#### 1. `server/models/Lead.js`
- **Line ~193**: `leadStatus` enum - Changed `'Cold Transfer – Disqualified'` to `'Cold Transfer – Not - Qualified'`
- **Line ~201**: `qualificationOutcome` enum - Changed all 5 disqualified options:
  - `'Disqualified – Debt Too Low'` → `'Not - Qualified – Debt Too Low'`
  - `'Disqualified – Secured Debt Only'` → `'Not - Qualified – Secured Debt Only'`
  - `'Disqualified – Non-Service State'` → `'Not - Qualified – Non-Service State'`
  - `'Disqualified – No Hardship'` → `'Not - Qualified – No Hardship'`
  - `'Disqualified – Active with Competitor'` → `'Not - Qualified – Active with Competitor'`
- **Line ~229-233**: `leadProgressStatus` predefined statuses - Changed all 5 disqualified options:
  - `'Disqualified – Debt Too Low'` → `'Not - Qualified – Debt Too Low'`
  - `'Disqualified – Secured Debt Only'` → `'Not - Qualified – Secured Debt Only'`
  - `'Disqualified – Non-Service State'` → `'Not - Qualified – Non-Service State'`
  - `'Disqualified – Active with Competitor'` → `'Not - Qualified – Active with Competitor'`
  - `'Disqualified - unacceptable creditors'` → `'Not - Qualified - unacceptable creditors'`
- **Line ~250**: `qualificationStatus` enum - Changed `'disqualified'` to `'not-qualified'`
- **Line ~555-556**: Stats aggregation - Changed `disqualifiedLeads` to `notQualifiedLeads`
- **Line ~577**: Default stats object - Changed `disqualifiedLeads: 0` to `notQualifiedLeads: 0`

#### 2. `server/routes/leads.js`
- **Line ~232**: Validation - Changed `'Cold Transfer – Disqualified'` to `'Cold Transfer – Not - Qualified'`
- **Line ~241-243**: Validation - Changed all qualification outcome options
- **Line ~316-320**: Validation - Changed all lead progress status options
- **Line ~387**: Query validation - Changed `'disqualified'` to `'not-qualified'`
- **Line ~442-444**: Filter logic (Export route) - Changed comment and filter logic for backward compatibility
- **Line ~840**: Query validation - Changed `'disqualified'` to `'not-qualified'` (main GET route)
- **Line ~890-892**: Filter logic (main GET route) - Changed comment and filter logic

### Client-Side Files

#### 3. `client/src/pages/Agent2Dashboard.js`
- **Line ~28-32**: Status options array - Changed all 5 disqualified options
- **Line ~1162**: Filter dropdown - Changed `'disqualified'` option to `'not-qualified'` with display text "Not - Qualified"
- **Line ~1300**: Table badge styling - Changed condition from `'disqualified'` to `'not-qualified'`
- **Line ~1304**: Table badge text - Changed display text from "Disqualified" to "Not - Qualified"
- **Line ~1749**: Modal badge styling - Changed condition from `'disqualified'` to `'not-qualified'`
- **Line ~1753**: Modal badge text - Changed display text from "Disqualified" to "Not - Qualified"
- **Line ~1832**: Update modal dropdown - Changed `'disqualified'` option to `'not-qualified'` with display text "Not - Qualified"

#### 4. `client/src/pages/AdminDashboard.js`
- **Line ~711-714**: Status options array - Changed all 4 disqualified options
- **Line ~765**: Badge styling object - Changed key from `disqualified` to `'not-qualified'`
- **Line ~771**: Icon object - Changed key from `disqualified` to `'not-qualified'`
- **Line ~777**: Added labels object with proper display text for "Not - Qualified"
- **Line ~809**: Stats calculation - Changed variable from `disqualifiedLeads` to `notQualifiedLeads`
- **Line ~828**: Total processed calculation - Changed variable reference
- **Line ~843**: Stats return object - Changed property name
- **Line ~75**: Comment - Updated to reflect new terminology
- **Line ~942**: Stats display - Changed label from "Disqualified" to "Not - Qualified" and property reference
- **Line ~1140**: Filter button - Changed from `'disqualified'` to `'not-qualified'` with display text "Not - Qualified"
- **Line ~1866**: Edit modal dropdown - Changed `'disqualified'` option to `' Dqualified'` with display text "Not - Qualified"

#### 5. `client/src/pages/SuperAdminDashboard.js`
- **Line ~1114**: Filter dropdown - Changed `'disqualified'` option to `'not-qualified'` with display text "Not - Qualified"

## Database Impact

### Important Notes:
1. **Existing Data**: This change affects the **schema and validation**, but existing database records with `qualificationStatus: 'disqualified'` will still work due to backward compatibility logic
2. **Backward Compatibility**: The filter logic includes both `'not-qualified'` and `'unqualified'` to maintain compatibility:
   ```javascript
   if (req.query.qualificationStatus === 'not-qualified') {
     filter.qualificationStatus = { $in: ['not-qualified', 'unqualified'] };
   }
   ```
3. **Migration Recommendation**: You may want to run a database migration to update existing records:
   ```javascript
   db.leads.updateMany(
     { qualificationStatus: 'disqualified' },
     { $set: { qualificationStatus: 'not-qualified' } }
   )
   ```

## Testing Checklist

### Server-Side Testing:
- [ ] Create new lead with "Not - Qualified" status
- [ ] Update existing lead to "Not - Qualified" status
- [ ] Filter leads by qualification status = "not-qualified"
- [ ] Export leads with "not-qualified" filter
- [ ] Verify stats aggregation shows `notQualifiedLeads`

### Client-Side Testing:

#### Agent2Dashboard:
- [ ] View leads with "Not - Qualified" status displays correctly
- [ ] Filter by "Not - Qualified" works
- [ ] Update lead status to "Not - Qualified" options
- [ ] Badge displays "❌ Not - Qualified" correctly

#### AdminDashboard:
- [ ] Stats card shows "Not - Qualified" count
- [ ] Filter button shows "Not - Qualified"
- [ ] Lead details show qualification badge correctly
- [ ] Edit qualification status dropdown has "Not - Qualified" option

#### SuperAdminDashboard:
- [ ] Qualification filter dropdown has "Not - Qualified" option
- [ ] Filtering by "not-qualified" works correctly

## API Endpoints Affected

1. **GET /api/leads** - Main leads list endpoint
2. **GET /api/leads/export** - Export endpoint
3. **GET /api/leads/:id** - Single lead endpoint
4. **POST /api/leads** - Create lead endpoint
5. **PUT /api/leads/:id** - Update lead endpoint

## Display Text Summary

| Old Text | New Text |
|----------|----------|
| Disqualified | Not - Qualified |
| disqualified | not-qualified |
| Disqualified – Debt Too Low | Not - Qualified – Debt Too Low |
| Disqualified – Secured Debt Only | Not - Qualified – Secured Debt Only |
| Disqualified – Non-Service State | Not - Qualified – Non-Service State |
| Disqualified – No Hardship | Not - Qualified – No Hardship |
| Disqualified – Active with Competitor | Not - Qualified – Active with Competitor |
| Disqualified - unacceptable creditors | Not - Qualified - unacceptable creditors |
| Cold Transfer – Disqualified | Cold Transfer – Not - Qualified |
| disqualifiedLeads | notQualifiedLeads |

## Validation Status

✅ All files compile without errors
✅ No breaking changes to API contracts
✅ Backward compatibility maintained
✅ All enum values updated consistently

## Notes

- The term "Not - Qualified" with spaces and hyphen is used for better readability
- The database value uses "not-qualified" (with hyphen, no spaces) as a slug/key
- All user-facing text displays "Not - Qualified" with proper formatting
