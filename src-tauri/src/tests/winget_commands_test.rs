#[cfg(test)]
mod tests {
    use crate::winget_commands::{parse_winget_table, WingetPackage};
    use crate::errors::WingetError;

    #[test]
    fn test_parse_winget_table_multiword_names() {
        let output = "Name                Id                        Version   Source\n-----------------------------------------------------------------\nVisual Studio Code  Microsoft.VisualStudioCode  1.95.0    winget\nGoogle Chrome       Google.Chrome               130.0     winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 2);
        
        // First package: Visual Studio Code
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(packages[0].version, "1.95.0");
        assert_eq!(packages[0].source, Some("winget".to_string()));
        assert_eq!(packages[0].description, None);
        
        // Second package: Google Chrome
        assert_eq!(packages[1].name, "Google Chrome");
        assert_eq!(packages[1].id, "Google.Chrome");
        assert_eq!(packages[1].version, "130.0");
    }

    #[test]
    fn test_parse_winget_table_varying_widths() {
        let output = "Name                           Id              Version  Source\n------------------------------------------------------------------\nDiscord                        Discord.Discord 1.0.9000 winget\nPython 3.12 (64-bit)           Python.Python.3.12  3.12.0   winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "Discord");
        assert_eq!(packages[0].id, "Discord.Discord");
        assert_eq!(packages[1].name, "Python 3.12 (64-bit)");
        assert_eq!(packages[1].id, "Python.Python.3.12");
        assert_eq!(packages[1].version, "3.12.0");
    }

    #[test]
    fn test_parse_winget_table_empty() {
        let output = "Name      Id      Version  Source\n--------------------------------\n";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 0);
    }

    #[test]
    fn test_parse_winget_table_no_header() {
        let output = "Some random text without proper header\n";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 0);
    }

    #[test]
    fn test_parse_winget_table_single_word_name() {
        let output = "Name      Id              Version  Source\n-----------------------------------------\nOBS       OBSProject.OBSStudio  30.0     winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "OBS");
        assert_eq!(packages[0].id, "OBSProject.OBSStudio");
    }

    #[test]
    fn test_parse_winget_table_no_source_column() {
        let output = "Name                Id                        Version\n------------------------------------------------------\nVisual Studio Code  Microsoft.VisualStudioCode  1.95.0\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].source, None);
    }

    #[test]
    fn test_parse_winget_table_special_characters() {
        let output = "Name                 Id              Version  Source\n-------------------------------------------------------\n7-Zip File Manager   7zip.7zip       23.01    winget\nNode.js              OpenJS.NodeJS   20.11.0  winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "7-Zip File Manager");
        assert_eq!(packages[0].id, "7zip.7zip");
        assert_eq!(packages[1].name, "Node.js");
        assert_eq!(packages[1].id, "OpenJS.NodeJS");
    }
}
