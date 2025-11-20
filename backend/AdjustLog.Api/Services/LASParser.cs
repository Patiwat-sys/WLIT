using System.Text.RegularExpressions;
using AdjustLog.Api.Models;

namespace AdjustLog.Api.Services;

public class LASParser : ILASParser
{
    private double nullValue = -99999;

    public ParsedLASData Parse(string filePath)
    {
        var content = File.ReadAllText(filePath);
        var lines = content.Split('\n');

        var metadata = new LASMetadata();
        var curves = new List<CurveInfo>();
        var data = new List<GeophysicalLog>();
        var curveNames = new List<string>();
        var currentSection = "";

        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();

            if (trimmedLine.StartsWith("~"))
            {
                currentSection = trimmedLine;
                continue;
            }

            if (trimmedLine.StartsWith("#") || string.IsNullOrWhiteSpace(trimmedLine))
            {
                continue;
            }

            // Parse VERSION section
            if (currentSection.Contains("VERSION"))
            {
                if (trimmedLine.Contains("NULL."))
                {
                    var match = Regex.Match(trimmedLine, @"NULL\.\s+(-?\d+)");
                    if (match.Success)
                    {
                        nullValue = double.Parse(match.Groups[1].Value);
                        metadata.NullValue = nullValue;
                    }
                }
            }

            // Parse WELL section
            if (currentSection.Contains("WELL"))
            {
                if (trimmedLine.Contains("STRT."))
                {
                    var match = Regex.Match(trimmedLine, @"STRT\.M\s+([\d.]+)");
                    if (match.Success)
                        metadata.StartDepth = double.Parse(match.Groups[1].Value);
                }
                if (trimmedLine.Contains("STOP."))
                {
                    var match = Regex.Match(trimmedLine, @"STOP\.M\s+([\d.]+)");
                    if (match.Success)
                        metadata.StopDepth = double.Parse(match.Groups[1].Value);
                }
                if (trimmedLine.Contains("STEP."))
                {
                    var match = Regex.Match(trimmedLine, @"STEP\.M\s+([\d.]+)");
                    if (match.Success)
                        metadata.Step = double.Parse(match.Groups[1].Value);
                }
                if (trimmedLine.Contains("WELL_ID."))
                {
                    var match = Regex.Match(trimmedLine, @"WELL_ID\.\s+(.+?)\s*:");
                    if (match.Success)
                    {
                        metadata.WellId = match.Groups[1].Value.Trim();
                    }
                }
            }

            // Parse CURVE section
            if (currentSection.Contains("CURVE"))
            {
                var parts = trimmedLine.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2)
                {
                    var curveDef = parts[0];
                    var match = Regex.Match(curveDef, @"(\w+)\.(\w+)");
                    if (match.Success)
                    {
                        var name = match.Groups[1].Value;
                        var unit = match.Groups[2].Value;
                        var description = trimmedLine.Contains(":") 
                            ? trimmedLine.Split(':')[1].Trim() 
                            : "";
                        
                        curves.Add(new CurveInfo
                        {
                            Name = name,
                            Unit = unit,
                            Description = description
                        });
                        curveNames.Add(name.ToLower());
                    }
                }
            }

            // Parse data section
            if (currentSection.Contains("~A") || currentSection.Contains("~ASCII"))
            {
                var values = trimmedLine.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (values.Length == 0 || curveNames.Count == 0)
                {
                    continue;
                }

                var logEntry = new GeophysicalLog();
                var depthAssigned = false;

                for (int j = 0; j < curveNames.Count && j < values.Length; j++)
                {
                    var valueStr = values[j];
                    if (!double.TryParse(valueStr, out var value))
                    {
                        continue;
                    }

                    if (value == nullValue)
                    {
                        value = double.NaN;
                    }

                    var curveName = curveNames[j];
                    switch (curveName)
                    {
                        case "dept":
                        case "depth":
                            if (!double.IsNaN(value))
                            {
                                logEntry.Depth = value;
                                depthAssigned = true;
                            }
                            break;
                        case "natu":
                            logEntry.Natu = double.IsNaN(value) ? null : value;
                            break;
                        case "long":
                            logEntry.Long = double.IsNaN(value) ? null : value;
                            break;
                        case "high":
                            logEntry.High = double.IsNaN(value) ? null : value;
                            break;
                        case "bore":
                            logEntry.Bore = double.IsNaN(value) ? null : value;
                            break;
                        default:
                            logEntry.AdditionalCurves[curveName] = double.IsNaN(value) ? null : value;
                            break;
                    }
                }

                if (depthAssigned)
                {
                    data.Add(logEntry);
                }
            }
        }

        return new ParsedLASData
        {
            Metadata = metadata,
            Curves = curves,
            Data = data
        };
    }
}

