using AdjustLog.Api.Models;

namespace AdjustLog.Api.Services;

public interface IExcelParser
{
    (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath);
    (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath, string sheetName);
    (List<LithologyInterval> Intervals, WellMetadata Metadata) ParseWithMapping(string filePath, string sheetName, ColumnMapping mapping);
    List<string> GetSheetNames(string filePath);
    List<Dictionary<string, object?>> GetPreviewData(string filePath, string sheetName, int maxRows = 50);
    Dictionary<string, object> GetRawData(string filePath, string sheetName, int maxRows = 50);
}

