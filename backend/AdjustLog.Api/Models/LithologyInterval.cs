namespace AdjustLog.Api.Models;

public class LithologyInterval
{
    public string Id { get; set; } = string.Empty;
    public double Top { get; set; }
    public double Bottom { get; set; }
    public double Thickness { get; set; }
    public string LithologyType { get; set; } = string.Empty;
    public int? RockCode { get; set; }
    public string? SplitedSeam { get; set; }
    public int? SplitedCode { get; set; }
    public double? AdjustedTop { get; set; }
    public double? AdjustedBottom { get; set; }
    
    public Dictionary<string, object?> AdditionalFields { get; set; } = new();
}

