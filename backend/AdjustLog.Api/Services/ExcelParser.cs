using OfficeOpenXml;
using AdjustLog.Api.Models;

namespace AdjustLog.Api.Services;

public class ExcelParser : IExcelParser
{
    public (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        var worksheet = package.Workbook.Worksheets[0];
        return ParseWorksheet(worksheet);
    }

    public (List<LithologyInterval> Intervals, WellMetadata Metadata) Parse(string filePath, string sheetName)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        var worksheet = package.Workbook.Worksheets[sheetName];
        if (worksheet == null)
        {
            throw new ArgumentException($"Sheet '{sheetName}' not found in the Excel file");
        }
        return ParseWorksheet(worksheet);
    }

    public List<string> GetSheetNames(string filePath)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        return package.Workbook.Worksheets.Select(ws => ws.Name).ToList();
    }

    public List<Dictionary<string, object?>> GetPreviewData(string filePath, string sheetName, int maxRows = 50)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        var worksheet = package.Workbook.Worksheets[sheetName];
        if (worksheet == null)
        {
            throw new ArgumentException($"Sheet '{sheetName}' not found in the Excel file");
        }

        var previewData = new List<Dictionary<string, object?>>();
        var startRow = 4; // Assuming data starts at row 4
        
        // Column mapping: B=2, C=3, D=4, E=5, H=8, V=22, AB=28, AC=29, AD=30
        var columnMap = new Dictionary<string, int>
        {
            { "From", 2 },      // B
            { "To", 3 },        // C
            { "Thickness", 4 }, // D
            { "Lithology", 5 }, // E (also used for color)
            { "Seam", 8 },      // H
            { "Sample No", 22 }, // V
            { "Remark", 28 },   // AB
            { "Clay color", 29 }, // AC
            { "Description", 30 } // AD
        };

        var endRow = Math.Min(startRow + maxRows - 1, worksheet.Dimension?.End.Row ?? startRow);
        
        for (int row = startRow; row <= endRow; row++)
        {
            // Parse From and To first to check if they exceed 1000
            var fromValue = ParseDouble(GetCellValue(worksheet, 2, row));
            var toValue = ParseDouble(GetCellValue(worksheet, 3, row));
            
            // Skip rows where From or To exceeds 1000
            if (fromValue.HasValue && fromValue.Value > 1000)
                continue;
            if (toValue.HasValue && toValue.Value > 1000)
                continue;
            
            var rowData = new Dictionary<string, object?>();
            
            foreach (var kvp in columnMap)
            {
                var value = GetCellValue(worksheet, kvp.Value, row);
                
                // Format numeric values to 2 decimal places
                if (kvp.Key == "From" || kvp.Key == "To" || kvp.Key == "Thickness")
                {
                    var numValue = ParseDouble(value);
                    if (numValue.HasValue)
                    {
                        rowData[kvp.Key] = numValue.Value.ToString("F2");
                    }
                    else
                    {
                        rowData[kvp.Key] = value;
                    }
                }
                else
                {
                    rowData[kvp.Key] = value;
                }
            }
            
            // Check if row has any data
            if (rowData.Values.Any(v => v != null && !string.IsNullOrWhiteSpace(v.ToString())))
            {
                previewData.Add(rowData);
            }
        }

        return previewData;
    }

    private (List<LithologyInterval> Intervals, WellMetadata Metadata) ParseWorksheet(ExcelWorksheet worksheet)
    {

        // Extract metadata from row 3 (index 3)
        var metadata = new WellMetadata
        {
            WellId = GetCellValue(worksheet, 1, 3) ?? "",
            Easting = ParseDouble(GetCellValue(worksheet, 2, 3)),
            Northing = ParseDouble(GetCellValue(worksheet, 3, 3)),
            Elevation = ParseDouble(GetCellValue(worksheet, 4, 3)),
            Azimuth = ParseDouble(GetCellValue(worksheet, 5, 3)),
            DipDegree = ParseDouble(GetCellValue(worksheet, 6, 3)),
            Depth = ParseDouble(GetCellValue(worksheet, 7, 3)),
            XSectionLine = GetCellValue(worksheet, 23, 3), // Column W (index 23)
            Year = GetCellValue(worksheet, 24, 3), // Column X (index 24)
            Geologist = GetCellValue(worksheet, 25, 3), // Column Y (index 25)
            GeophysicalDepth = ParseDouble(GetCellValue(worksheet, 26, 3)), // Column Z (index 26)
        };

        // Parse data rows (starting from row 4, index 4)
        var intervals = new List<LithologyInterval>();
        var startRow = 4;

        for (int row = startRow; row <= worksheet.Dimension?.End.Row; row++)
        {
            var dhid = GetCellValue(worksheet, 1, row);
            if (string.IsNullOrWhiteSpace(dhid))
                continue;

            var from = ParseDouble(GetCellValue(worksheet, 2, row)); // Column B
            var to = ParseDouble(GetCellValue(worksheet, 3, row)); // Column C
            var thickness = ParseDouble(GetCellValue(worksheet, 4, row)); // Column D
            var lithologyCode = GetCellValue(worksheet, 5, row) ?? ""; // Column E - used for color coding
            var seam = GetCellValue(worksheet, 8, row); // Column H

            if (!from.HasValue || !to.HasValue)
                continue;

            // Skip rows where From or To exceeds 1000
            if (from.Value > 1000 || to.Value > 1000)
                continue;

            // Round numeric values to 2 decimal places
            var roundedFrom = Math.Round(from.Value, 2);
            var roundedTo = Math.Round(to.Value, 2);
            var calculatedThickness = thickness ?? (roundedTo - roundedFrom);
            var roundedThickness = Math.Round(calculatedThickness, 2);

            var interval = new LithologyInterval
            {
                Id = $"interval-{row}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                Top = roundedFrom,
                Bottom = roundedTo,
                Thickness = roundedThickness,
                LithologyType = lithologyCode, // Column E value (LI, CLLI, LICL, CBCL, etc.)
                RockCode = ParseInt(GetCellValue(worksheet, 8, row)), // Column H (index 8)
                SplitedSeam = seam, // Column H
                SplitedCode = ParseInt(GetCellValue(worksheet, 9, row)), // Column I (index 9)
            };

            // Add additional columns 1-20, 22, 28-30
            for (int col = 1; col <= 20; col++)
            {
                var header = GetCellValue(worksheet, col, 2); // Row 2 for headers
                if (!string.IsNullOrWhiteSpace(header))
                {
                    interval.AdditionalFields[$"col{col}"] = GetCellValue(worksheet, col, row);
                }
            }

            // Store specific columns with named keys for easier access
            // Column H (index 8) - Seam (already in SplitedSeam, but also store in AdditionalFields)
            interval.AdditionalFields["Seam"] = seam;
            
            // Column V (index 22) - Sample No
            var sampleNo = GetCellValue(worksheet, 22, row);
            interval.AdditionalFields["SampleNo"] = sampleNo;
            interval.AdditionalFields["col22"] = sampleNo; // Keep for backward compatibility
            
            // Column AB (index 28) - Remark
            var remark = GetCellValue(worksheet, 28, row);
            interval.AdditionalFields["Remark"] = remark;
            interval.AdditionalFields["col28"] = remark; // Keep for backward compatibility
            
            // Column AC (index 29) - Clay color
            var clayColor = GetCellValue(worksheet, 29, row);
            interval.AdditionalFields["ClayColor"] = clayColor;
            interval.AdditionalFields["col29"] = clayColor; // Keep for backward compatibility
            
            // Column AD (index 30) - Description
            var description = GetCellValue(worksheet, 30, row);
            interval.AdditionalFields["Description"] = description;
            interval.AdditionalFields["col30"] = description; // Keep for backward compatibility

            intervals.Add(interval);
        }

        return (intervals, metadata);
    }

    private string? GetCellValue(ExcelWorksheet worksheet, int col, int row)
    {
        try
        {
            var cell = worksheet.Cells[row, col];
            if (cell.Value == null)
                return null;
            return cell.Value.ToString()?.Trim();
        }
        catch
        {
            return null;
        }
    }

    private double? ParseDouble(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        if (double.TryParse(value, out var result))
            return result;
        return null;
    }

    private int? ParseInt(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        if (int.TryParse(value, out var result))
            return result;
        return null;
    }

    public (List<LithologyInterval> Intervals, WellMetadata Metadata) ParseWithMapping(string filePath, string sheetName, ColumnMapping mapping)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        var worksheet = package.Workbook.Worksheets[sheetName];
        if (worksheet == null)
        {
            throw new ArgumentException($"Sheet '{sheetName}' not found in the Excel file");
        }
        return ParseWorksheetWithMapping(worksheet, mapping);
    }

    public Dictionary<string, object> GetRawData(string filePath, string sheetName, int maxRows = 50)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        
        using var package = new ExcelPackage(new FileInfo(filePath));
        var worksheet = package.Workbook.Worksheets[sheetName];
        if (worksheet == null)
        {
            throw new ArgumentException($"Sheet '{sheetName}' not found in the Excel file");
        }

        var result = new Dictionary<string, object>();
        
        // Get all column headers (default to row 2)
        var maxCol = worksheet.Dimension?.End.Column ?? 0;
        var headerRow = 2; // Default header row
        var dataStartRow = 4; // Default data start row
        
        var headers = new List<string>();
        for (int col = 1; col <= maxCol; col++)
        {
            var headerValue = GetCellValue(worksheet, col, headerRow);
            headers.Add(headerValue ?? $"Column {GetColumnLetter(col)}");
        }
        result["headers"] = headers;
        
        // Get preview rows
        var previewRows = new List<Dictionary<string, object?>>();
        var endRow = Math.Min(dataStartRow + maxRows - 1, worksheet.Dimension?.End.Row ?? dataStartRow);
        
        for (int row = dataStartRow; row <= endRow; row++)
        {
            var rowData = new Dictionary<string, object?>();
            for (int col = 1; col <= maxCol; col++)
            {
                var value = GetCellValue(worksheet, col, row);
                rowData[$"col{col}"] = value;
            }
            previewRows.Add(rowData);
        }
        result["previewRows"] = previewRows;
        result["maxColumn"] = maxCol;
        
        return result;
    }

    private string GetColumnLetter(int columnNumber)
    {
        string columnLetter = "";
        while (columnNumber > 0)
        {
            columnNumber--;
            columnLetter = (char)('A' + columnNumber % 26) + columnLetter;
            columnNumber /= 26;
        }
        return columnLetter;
    }

    private (List<LithologyInterval> Intervals, WellMetadata Metadata) ParseWorksheetWithMapping(ExcelWorksheet worksheet, ColumnMapping mapping)
    {
        // Extract metadata
        var metadata = new WellMetadata();
        if (mapping.MetadataRow.HasValue)
        {
            if (mapping.WellId.HasValue)
                metadata.WellId = GetCellValue(worksheet, mapping.WellId.Value, mapping.MetadataRow.Value) ?? "";
            if (mapping.Easting.HasValue)
                metadata.Easting = ParseDouble(GetCellValue(worksheet, mapping.Easting.Value, mapping.MetadataRow.Value));
            if (mapping.Northing.HasValue)
                metadata.Northing = ParseDouble(GetCellValue(worksheet, mapping.Northing.Value, mapping.MetadataRow.Value));
            if (mapping.Elevation.HasValue)
                metadata.Elevation = ParseDouble(GetCellValue(worksheet, mapping.Elevation.Value, mapping.MetadataRow.Value));
            if (mapping.Azimuth.HasValue)
                metadata.Azimuth = ParseDouble(GetCellValue(worksheet, mapping.Azimuth.Value, mapping.MetadataRow.Value));
            if (mapping.DipDegree.HasValue)
                metadata.DipDegree = ParseDouble(GetCellValue(worksheet, mapping.DipDegree.Value, mapping.MetadataRow.Value));
            if (mapping.Depth.HasValue)
                metadata.Depth = ParseDouble(GetCellValue(worksheet, mapping.Depth.Value, mapping.MetadataRow.Value));
            if (mapping.XSectionLine.HasValue)
                metadata.XSectionLine = GetCellValue(worksheet, mapping.XSectionLine.Value, mapping.MetadataRow.Value);
            if (mapping.Year.HasValue)
                metadata.Year = GetCellValue(worksheet, mapping.Year.Value, mapping.MetadataRow.Value);
            if (mapping.Geologist.HasValue)
                metadata.Geologist = GetCellValue(worksheet, mapping.Geologist.Value, mapping.MetadataRow.Value);
            if (mapping.GeophysicalDepth.HasValue)
                metadata.GeophysicalDepth = ParseDouble(GetCellValue(worksheet, mapping.GeophysicalDepth.Value, mapping.MetadataRow.Value));
        }

        // Parse data rows
        var intervals = new List<LithologyInterval>();
        var startRow = mapping.DataStartRow;

        for (int row = startRow; row <= worksheet.Dimension?.End.Row; row++)
        {
            // Get DHID if mapped
            string? dhid = null;
            if (mapping.DHID.HasValue)
            {
                dhid = GetCellValue(worksheet, mapping.DHID.Value, row);
                if (string.IsNullOrWhiteSpace(dhid))
                    continue;
            }

            // Get From and To (required)
            var from = ParseDouble(GetCellValue(worksheet, mapping.From, row));
            var to = ParseDouble(GetCellValue(worksheet, mapping.To, row));

            if (!from.HasValue || !to.HasValue)
                continue;

            // Skip rows where From or To exceeds 1000
            if (from.Value > 1000 || to.Value > 1000)
                continue;

            // Get Thickness
            double? thickness = null;
            if (mapping.Thickness.HasValue)
            {
                thickness = ParseDouble(GetCellValue(worksheet, mapping.Thickness.Value, row));
            }

            // Get Lithology
            string lithologyCode = "";
            if (mapping.Lithology.HasValue)
            {
                lithologyCode = GetCellValue(worksheet, mapping.Lithology.Value, row) ?? "";
            }

            // Get Seam
            string? seam = null;
            if (mapping.Seam.HasValue)
            {
                seam = GetCellValue(worksheet, mapping.Seam.Value, row);
            }

            // Round numeric values to 2 decimal places
            var roundedFrom = Math.Round(from.Value, 2);
            var roundedTo = Math.Round(to.Value, 2);
            var calculatedThickness = thickness ?? (roundedTo - roundedFrom);
            var roundedThickness = Math.Round(calculatedThickness, 2);

            var interval = new LithologyInterval
            {
                Id = $"interval-{row}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                Top = roundedFrom,
                Bottom = roundedTo,
                Thickness = roundedThickness,
                LithologyType = lithologyCode,
                SplitedSeam = seam,
            };

            // Add mapped fields to AdditionalFields
            if (mapping.Seam.HasValue)
            {
                interval.AdditionalFields["Seam"] = seam;
            }
            if (mapping.SampleNo.HasValue)
            {
                var sampleNo = GetCellValue(worksheet, mapping.SampleNo.Value, row);
                interval.AdditionalFields["SampleNo"] = sampleNo;
            }
            if (mapping.Remark.HasValue)
            {
                var remark = GetCellValue(worksheet, mapping.Remark.Value, row);
                interval.AdditionalFields["Remark"] = remark;
            }
            if (mapping.ClayColor.HasValue)
            {
                var clayColor = GetCellValue(worksheet, mapping.ClayColor.Value, row);
                interval.AdditionalFields["ClayColor"] = clayColor;
            }
            if (mapping.Description.HasValue)
            {
                var description = GetCellValue(worksheet, mapping.Description.Value, row);
                interval.AdditionalFields["Description"] = description;
            }

            intervals.Add(interval);
        }

        return (intervals, metadata);
    }
}

