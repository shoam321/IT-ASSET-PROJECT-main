# Mindee Receipt Parsing Fix - December 29, 2025

## Issue
Receipt parsing was failing in production (Railway) with errors:
- `⚠️ Mindee parsing error: mindeeClient.docFromPath is not a function`
- `⚠️ Mindee parsing error: mindeeClient.loadDocument is not a function`

## Root Cause
The code was using `ClientV2` (V2 API) but trying to call V1 API methods. The V2 API uses different methods:
- V1: `new mindee.Client()` with `mindeeClient.docFromPath()` and `mindeeClient.parse()`
- V2: `new mindee.ClientV2()` with `new mindee.PathInput()` and `mindeeClient.enqueueAndGetInference()`

For Receipt V5 parsing, the V1 API is simpler and more appropriate.

## Solution
Switched from ClientV2 to Client (V1 API) in `itam-saas/Agent/server.js`:

### Before:
```javascript
// Initialize with V2
const mindeeClient = process.env.MINDEE_API_KEY 
  ? new mindee.ClientV2({ apiKey: process.env.MINDEE_API_KEY })
  : null;

// Try to use V1 methods on V2 client (WRONG!)
const inputSource = mindeeClient.docFromPath(req.file.path);
const response = await mindeeClient.enqueueAndParse(mindee.product.ReceiptV5, inputSource);
```

### After:
```javascript
// Initialize with V1 (correct for ReceiptV5)
const mindeeClient = process.env.MINDEE_API_KEY 
  ? new mindee.Client({ apiKey: process.env.MINDEE_API_KEY })
  : null;

// Use V1 methods (correct!)
const inputSource = mindeeClient.docFromPath(req.file.path);
const response = await mindeeClient.parse(mindee.product.ReceiptV5, inputSource);
const document = response.document.inference.prediction;
```

## Changes Made
1. Changed `new mindee.ClientV2()` → `new mindee.Client()` (use V1 API)
2. Changed `mindeeClient.enqueueAndParse()` → `mindeeClient.parse()` (synchronous parsing)
3. Removed unused `MINDEE_MODEL_ID` constant (not needed for standard ReceiptV5)
4. Response structure is `response.document.inference.prediction` (V1 format)

## Why V1 API?
- Receipt V5 is a standard Mindee product that works with both V1 and V2
- V1 API is simpler for synchronous parsing
- V1 has the `docFromPath()` convenience method
- V2 is designed for custom models and async workflows

## Files Modified
- `itam-saas/Agent/server.js` - Receipt upload endpoint (POST /api/assets/:assetId/receipts)

## Deployment Required
Changes need to be committed and pushed to trigger Railway deployment.

## Testing
After deployment, test by:
1. Upload a receipt (PDF or image) to an asset
2. Verify Mindee parsing completes without errors
3. Check that merchant, date, total amount are extracted correctly
4. Verify auto-update of asset cost if it was $0

## References
- [Mindee V1 API Documentation](https://docs.mindee.com/v1/libraries/nodejs-sdk)
- [Receipt V5 Documentation](https://docs.mindee.com/expense-management-apis/expense-receipts-ocr)
- [Node.js SDK Repository](https://github.com/mindee/mindee-api-nodejs)
