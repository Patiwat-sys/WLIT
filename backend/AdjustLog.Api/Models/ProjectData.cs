namespace AdjustLog.Api.Models;

public class ProjectData
{
    public string WellId { get; set; } = string.Empty;
    public WellMetadata Metadata { get; set; } = new();
    public List<GeophysicalLog> GeophysicalLogs { get; set; } = new();
    public List<LithologyInterval> LithologyIntervals { get; set; } = new();
    public List<AdjustmentHistory> Adjustments { get; set; } = new();
    public string Version { get; set; } = "1.0.0";
    public string LastModified { get; set; } = DateTime.UtcNow.ToString("O");
}

public class AdjustmentHistory
{
    public string Id { get; set; } = string.Empty;
    public string IntervalId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "top" or "bottom"
    public double OldValue { get; set; }
    public double NewValue { get; set; }
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");
}

