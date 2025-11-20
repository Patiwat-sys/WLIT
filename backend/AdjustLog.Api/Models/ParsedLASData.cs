namespace AdjustLog.Api.Models;

public class ParsedLASData
{
    public LASMetadata Metadata { get; set; } = new();
    public List<CurveInfo> Curves { get; set; } = new();
    public List<GeophysicalLog> Data { get; set; } = new();
}

public class LASMetadata
{
    public double StartDepth { get; set; }
    public double StopDepth { get; set; }
    public double Step { get; set; }
    public double NullValue { get; set; } = -99999;
    public string? WellId { get; set; }
    
    public Dictionary<string, object?> AdditionalFields { get; set; } = new();
}

public class CurveInfo
{
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

