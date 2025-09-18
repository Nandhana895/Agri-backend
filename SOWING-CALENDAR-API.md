# Sowing Calendar API Documentation

## Overview
The Sowing Calendar API provides farmers with precise sowing timing information for various crops based on region, season, and agro-climatic zones. This professional implementation includes sophisticated matching logic and comprehensive error handling.

## Endpoint
```
GET /api/farmer/sowing-calendar
```

## Authentication
- **Required**: Bearer token in Authorization header
- **Roles**: Authenticated farmers, officers, and admins
- **Rate Limiting**: 30 requests per 15 minutes per IP

## Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `crop` | string | ✅ | Crop name to search for | `Rice`, `Wheat`, `Maize` |
| `region` | string | ❌ | Specific region/state | `Punjab`, `Kerala`, `Gujarat` |
| `season` | string | ❌ | Growing season | `Kharif`, `Rabi`, `Zaid` |

## Matching Logic (Priority Order)

### 1. Exact Region Match
- **Priority**: Highest
- **Logic**: `crop_lower` + `region` exact match
- **Example**: Rice in Punjab

### 2. Agro-Zone Match
- **Priority**: High
- **Logic**: `crop_lower` + `agroZone` match
- **Fallback**: When region-specific data unavailable
- **Zones**: humid, arid, temperate, semi-arid

### 3. General Fallback
- **Priority**: Medium
- **Logic**: `crop_lower` + `region: "all"` or general records
- **Use Case**: No region-specific data available

## Response Schema

### Success Response (200)
```json
{
  "results": [
    {
      "crop": "Rice",
      "season": "Kharif",
      "startMonth": "June",
      "endMonth": "July",
      "region": "Kerala",
      "agroZone": "humid",
      "varieties": ["Swarna", "MTU-1010"],
      "notes": "Sown with the onset of monsoon; ensure standing water.",
      "source": "ICAR 2023",
      "lastUpdated": "2025-07-01T00:00:00.000Z"
    }
  ],
  "matchExplanation": "Found 1 exact match(es) for \"Rice\" in region \"Kerala\"",
  "totalMatches": 1
}
```

### Error Responses

#### 400 Bad Request - Missing Crop
```json
{
  "success": false,
  "message": "Crop parameter is required. Please specify the crop name."
}
```

#### 400 Bad Request - Invalid Season
```json
{
  "success": false,
  "message": "Invalid season. Must be one of: Kharif, Rabi, Zaid"
}
```

#### 404 Not Found - No Match
```json
{
  "success": false,
  "message": "No calendar found for this crop in your region. Please contact local agri-office."
}
```

#### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Too many requests for sowing calendar. Please try again later."
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch sowing calendar data. Please try again later."
}
```

## Example Usage

### Basic Crop Search
```bash
curl -X GET "http://localhost:5000/api/farmer/sowing-calendar?crop=rice" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Region-Specific Search
```bash
curl -X GET "http://localhost:5000/api/farmer/sowing-calendar?crop=wheat&region=Punjab" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Season-Specific Search
```bash
curl -X GET "http://localhost:5000/api/farmer/sowing-calendar?crop=maize&season=Kharif" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Combined Search
```bash
curl -X GET "http://localhost:5000/api/farmer/sowing-calendar?crop=cotton&region=Gujarat&season=Kharif" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## JavaScript/React Example

```javascript
// API service function
const getSowingCalendar = async (crop, region = null, season = null) => {
  const params = new URLSearchParams({ crop });
  if (region) params.append('region', region);
  if (season) params.append('season', season);
  
  const response = await fetch(`/api/farmer/sowing-calendar?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};

// Usage in React component
const SowingCalendarComponent = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchCalendar = async (crop, region, season) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getSowingCalendar(crop, region, season);
      setCalendarData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Your UI components here */}
    </div>
  );
};
```

## Data Model

### CropCalendar Schema
```javascript
{
  crop: String,           // Required, indexed
  crop_lower: String,     // Required, lowercase version for search
  season: String,         // Required, enum: ["Kharif","Rabi","Zaid"]
  startMonth: String,     // Required, e.g., "June"
  endMonth: String,       // Required, e.g., "July"
  region: String,         // Optional, state/district or "all"
  agroZone: String,       // Optional, e.g., "humid", "arid"
  notes: String,          // Optional
  varieties: [String],    // Optional array
  source: String,         // Optional, e.g., "ICAR 2024"
  lastUpdated: Date,      // Default: Date.now
  version: Number         // Default: 1
}
```

### Indexes
- `crop_lower`: Single field index for fast crop search
- `crop_lower + region`: Compound index for region-specific queries
- `season + region`: Compound index for season-based queries
- `agroZone + season`: Compound index for agro-zone queries

## Rate Limiting
- **Window**: 15 minutes
- **Limit**: 30 requests per IP
- **Headers**: Standard rate limit headers included
- **Response**: 429 status with helpful message

## Security Features
- JWT token authentication required
- User role validation (farmers, officers, admins)
- Rate limiting to prevent abuse
- Input validation and sanitization
- SQL injection protection via Mongoose

## Performance Optimizations
- Compound indexes for common query patterns
- Efficient regex matching with case-insensitive search
- Priority-based matching to reduce database queries
- Connection pooling and query optimization

## Error Handling
- Comprehensive validation for all input parameters
- Graceful fallback for missing data
- Detailed error messages for debugging
- Proper HTTP status codes
- Logging for monitoring and debugging

## Testing
The API includes comprehensive test coverage:
- Unit tests for all matching logic
- Integration tests for database operations
- Error scenario testing
- Performance testing for rate limits
- Response format validation

## Monitoring
- Request logging for analytics
- Error tracking and alerting
- Performance metrics collection
- Rate limit monitoring
- Database query optimization tracking
