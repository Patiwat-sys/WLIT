namespace AdjustLog.Api.Models;

public class GeophysicalLog
{
    public double Depth { get; set; }
    public double? Natu { get; set; }
    public double? Long { get; set; }
    public double? High { get; set; }
    public double? Bore { get; set; }
    
    public Dictionary<string, double?> AdditionalCurves { get; set; } = new();
}

