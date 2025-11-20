namespace AdjustLog.Api.Models;

public class ColumnMapping
{
    public int? DHID { get; set; }
    public int From { get; set; }      // Required
    public int To { get; set; }        // Required
    public int? Thickness { get; set; }
    public int? Lithology { get; set; }
    public int? Seam { get; set; }
    public int? SampleNo { get; set; }
    public int? Remark { get; set; }
    public int? ClayColor { get; set; }
    public int? Description { get; set; }
    
    // Metadata columns (optional)
    public int? WellId { get; set; }
    public int? Easting { get; set; }
    public int? Northing { get; set; }
    public int? Elevation { get; set; }
    public int? Azimuth { get; set; }
    public int? DipDegree { get; set; }
    public int? Depth { get; set; }
    public int? XSectionLine { get; set; }
    public int? Year { get; set; }
    public int? Geologist { get; set; }
    public int? GeophysicalDepth { get; set; }
    
    // Data start row (1-based, default 4)
    public int DataStartRow { get; set; } = 4;
    
    // Header row (1-based, default 2, for column names)
    public int? HeaderRow { get; set; }
    
    // Metadata row (1-based, default 3)
    public int? MetadataRow { get; set; } = 3;
}

