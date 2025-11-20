namespace AdjustLog.Api.Models;

public class WellMetadata
{
    public string WellId { get; set; } = string.Empty;
    public double? Easting { get; set; }
    public double? Northing { get; set; }
    public double? Elevation { get; set; }
    public double? Azimuth { get; set; }
    public double? DipDegree { get; set; }
    public double? Depth { get; set; }
    public double? GeophysicalDepth { get; set; }
    public string? XSectionLine { get; set; }
    public string? Year { get; set; }
    public string? Geologist { get; set; }
    
    public Dictionary<string, object?> AdditionalFields { get; set; } = new();
}

