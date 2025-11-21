using AdjustLog.Api.Models;

namespace AdjustLog.Api.Services;

public interface IExcelParser
{
    (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath, int? headerRow = null, int? metadataRow = null, int? dataStartRow = null);
    (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath, string sheetName, int? headerRow = null, int? metadataRow = null, int? dataStartRow = null);
    (List<LithologyInterval> Intervals, WellMetadata Metadata) ParseWithMapping(string filePath, string sheetName, ColumnMapping mapping);
    List<string> GetSheetNames(string filePath);
    List<Dictionary<string, object?>> GetPreviewData(string filePath, string sheetName, int maxRows = 50, int? headerRow = null, int? dataStartRow = null);
    Dictionary<string, object> GetRawData(string filePath, string sheetName, int maxRows = 50, int? headerRow = null, int? dataStartRow = null);
}

