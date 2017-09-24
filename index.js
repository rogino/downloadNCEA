/*jshint esversion: 6 */
let download = require("download");
let inquirer = require("inquirer");
let fs = require("fs");
let baseDirectory = "C:/Users/Rio/OneDrive - Christchurch Boys' High School/School Work/Year 12/NCEAPastPapers/";
inquirer.registerPrompt("directory", require("inquirer-directory"));


let reg = {
  file: new RegExp(/\.\w+$/g),
  directoryWindows: new RegExp(/^\s*[^\>\<\\\"\/\|\?\*\.]+\s*$/g),
  integer: new RegExp(/^\s*\d+\s*$/),
  year_2_4: new RegExp(/(?:^\s*(?:\d{2}|\d{4})?\s*$)?/)
};


let name = {
  capitalizeWord: (string, justTheFirstWord) => {
    if (justTheFirstWord) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    } else {
      let arr = string.split(" "); //Only works with spaces. Consider looping with reg.exec to capitalize and add the matched whitespace character
      let str = "";
      for (let i of arr) {
        str += name.capitalizeWord(i, true);
      }
      return str;
    }
  },
  standardFolder: (standardCode, standardName) => `${standardCode} ${name.capitalizeWord(standardName, false)}`,
  standardFile: (standardCode, year, type) => `${standardCode}-${year}-${type}.pdf`,
  concatDir: (...arr) => {
    arr = arr.map(str => str.replace("\\", "/")).filter(str => str.length !== 0); //Replace backslashes with slash, remove empty strings
    let str = "";
    for (let i of arr) {
      str += i;
      if (i.substr(-1) != "/" && (i == arr[arr.length - 1] && !i.match(/.+\.\w+$/))) {
        str += "/"; //Add a backslash if there isn't one at the end, but not if it is the last one in the array and is a file 
      }
    }
    return str;
  }
};


let askUser = () => {
  inquirer.prompt([{
      type: "input",
      name: "standardCode",
      message: "Standard code: ",
      validate: val => (val.match(reg.integer)) ? true : "Enter numerical standard code"
    }, {
      type: "input",
      name: "standardName",
      message: "Name of standard (e.g. Mechanics): ",
      validate: val => val.match(reg.folderWindows) ? true : "Please enter a valid directory name"
    }, {
      type: "input",
      name: "year",
      message: "Year of exam (or nothing for all from 2012): ",
      validate: val => (val.match(reg.year_2_4) ? true : "Enter 2/4 digit year, or nothing for all years")
    }, {
      type: "list",
      name: "downloadOptions",
      message: "Download:",
      choices: [{
        name: "Exam paper and marking schedule",
        value: ["exam", "marking"]
      }, {
        name: "Exam Paper, marking schedule and resource booklet",
        value: ["exam", "marking", "resource"]
      }, {
        name: "Exam paper, marking schedule, resource booklet and excellence exemplar",
        value: ["exam", "marking", "resource", "excellence"]
      }, {
        name: "Everything",
        value: ["exam", "marking", "resource", "notachieved", "achieved", "merit", "excellence"]
      }]
    }, {
      type: "list",
      name: "newSaveLocation",
      message: `Download to '${baseDirectory}'?`,
      choices: [{
        name: "Yes",
        value: true
      }, {
        name: "No",
        value: false
      }]
    }

  ]).then(val => {
    let func = (options, dir) => {
      //Because async/promises, and as both val.newSaveLocation values will require this function
      console.log(`Searching directory: ${dir}`);
      let newDir = directorySearch(dir,
        directory => (directory.includes(val.standardCode) || directory.toLowerCase().includes(val.standardName.toLowerCase())), 3);
      //newDir is the full path of the new directory
      if (newDir) {
        console.log(`Automatically detected directory, ${name.concatDir(newDir)}`);
        parseInput(val, newDir);
      } else {
        console.log(`Downloading to directory, ${name.concatDir(dir, name.standardFolder(val.standardCode, val.standardName))}`);
        parseInput(val, name.concatDir(dir, name.standardFolder(val.standardCode, val.standardName)));
      }
    };

    if (!val.newSaveLocation) {
      //If user wants to save in new location
      inquirer.prompt([{
        type: "directory",
        name: "saveLocation",
        message: "Base directory to save in: ",
        basePath: baseDirectory
      }]).then(newDir => {
        func(val, name.concatDir(baseDirectory, newDir.saveLocation));
      }).catch(err => {
        throw new Error(err);
      });
    } else {
      //Save in default location
      func(val, baseDirectory);
    }
  }).catch(err => {
    throw new Error(err);
  });
};

console.log(directorySearch("C:/Users/Rio/", val => val.includes("photo"), 4));


function directorySearch(directory, directoryFilter, maxSearchDepth = 1) {
  //Directory filter accepts the directory name and full path name as arguments
  //maxSearchDepth is the levels it will travel. 0 for no limit
  directory = name.concatDir(directory); //clean up backslashes
  let dirArr = directory.split("/"); //create array of directories
  deepest = dirArr[dirArr.length - 2]; //The name of the 'deepest' directory. -2 as string ends with a /, so will be an empty string. Thus, the second to last one.

  if (directoryFilter(deepest, directory)) return directory; //Check if the current directory matches the function

  else {
    //Recursive search function
    let search = (directory, depth, maxDepth) => {
      //Directory: will scan contents of the directory. Depth: current depth, starts at 1. Max depth: how deep you can go. 0 is no limit. 
      let folders;
      try {
        fs.readdirSync(directory);
      }
      catch(err) {
        if (!(err.code === "ENOTDIR" || err.code === "EPERM")) console.log(err);
        return false;
      }

      if (folders) {
        try {
          folders = folders.filter(name => fs.statSync(name).isDirectory());
        }
        catch(err) {
          if (!(err.code === "ENOTDIR" || err.code === "EPERM")) console.log(err);
        }
      }
      console.log(folders);

      //Get list of stuff in directory, and remove files from it
      for (let i of folders) {
        //Look through each subdirectory
        
        let dirPath = name.concatDir(directory, i); //Full path of the subdirectory
        if (directoryFilter(i, dirPath)) return dirPath;
        //Return if matches 

        else if (depth < maxDepth || depth === 0) {
          //Go deeper: looping through each subdirectory until maximum depth reached
          let val = search(dirPath, depth + 1, maxDepth);
          //Return it only if it has successfully gotten a match
          if (val) return val;
        }
      }
      /*
      try {
        let folders = fs.readdirSync(directory).filter(name => {
          fs.statSync(name, (err, stats) => {
            if (err) {
              if (err.code !== "ENOENT") console.log("!"); //Log non-ENOENT errors
              return false;
            }
            return stats.isDirectory(); 
          }); //Remove files from directory
        });//.filter(name => !name.match(reg.file));
        //Get list of stuff in directory, and remove files from it
        for (let i of folders) {
          //Look through each subdirectory
          
          let dirPath = name.concatDir(directory, i); //Full path of the subdirectory
          if (directoryFilter(i, dirPath)) return dirPath;
          //Return if matches 

          else if (depth < maxDepth || depth === 0) {
            //Go deeper: looping through each subdirectory until maximum depth reached
            let val = search(dirPath, depth + 1, maxDepth);
            //Return it only if it has successfully gotten a match
            if (val) return val;
          }
        }
      } catch (err) {
        if (!(err.code === "ENOTDIR" || err.code === "EPERM")) {
          //console.log(err);
        }
      }*/
    };
    let dirName = search(directory, 1, maxSearchDepth); //Start depth at 0
    if (dirName) return dirName;
  }

  return false; //No matches
}



function parseInput(result, directory) {
  let year = parseInt(result.year, 10);
  let standardCode = parseInt(result.standardCode, 10);

  if (isNaN(standardCode)) {
    throw new TypeError();
  }

  if (result.year.trim() === "") {
    for (let i = 2012; i < new Date().getFullYear(); i++) {
      //download all exams up to current year
      downloadPaper(directory, linkAnswers(i, standardCode, result.standardName), result.downloadOptions);
    }
    return 0; //Exit function
  }

  if (isNaN(year)) {
    throw new TypeError();
  }

  if (year < 100) {
    year = Math.floor(new Date().getFullYear() / 100) * 100 + year; //If two digit year, make it 4 digit
  }

  downloadPaper(directory, linkAnswers(year, standardCode, result.standardName), result.downloadOptions);
  return 0;
}




let linkAnswers = (year, standardCode, standardName) => {
  let baseLink = "http://www.nzqa.govt.nz/nqfdocs/ncea-resource";
  let obj = {
    year: year,
    standardCode: standardCode,
    standardName: standardName,
    exam: `${baseLink}/exams/${year}/${standardCode}-exm-${year}.pdf`,
    marking: `${baseLink}/schedules/${year}/${standardCode}-ass-${year}.pdf`,
    notachieved: `${baseLink}/examplars/${year}/${standardCode}-exp-${year}-notachieved.pdf`,
    achieved: `${baseLink}/examplars/${year}/${standardCode}-exp-${year}-achieved.pdf`,
    merit: `${baseLink}/examplars/${year}/${standardCode}-exp-${year}-merit.pdf`,
    excellence: `${baseLink}/examplars/${year}/${standardCode}-exp-${year}-excellence.pdf`,
    resource: `${baseLink}/exams/${year}/${standardCode}-res-${year}.pdf`
  };
  return obj;
};



let downloadPaper = (directory, object, toDownload, overwrite = false) => {
  console.log(`Downloading ${object.year} ${object.standardCode} papers to ${directory}`);

  if (!overwrite) {
    for (let i = toDownload.length - 1; i >= 0; i--) {
      if (fs.existsSync(name.concatDir(directory, name.standardFile(object.standardCode, object.year, toDownload[i])))) {
        //Checks if the file that is going to be created actually exists
        console.log(`'${name.standardFile(object.standardCode, object.year, toDownload[i])}' already exists: skipping download`);
        toDownload = toDownload.splice(i, 1); //Remove element from the array
        //Going in reverse, so removing an element will have no effect on the ones before it
      }
    }
  }

  return 0;
  Promise.all(toDownload.map(i => download(object[i], directory, {
    filename: name.standardFile(object.standardCode, object.year, i)
  }))).then(val => {
    console.log(`Downloads for ${object.year} ${object.standardCode} finished`);
  }).catch(err => {
    if (err.name == "HTTPError" && err.statusCode == 404) {
      console.log(`404 (File not found) error downloading '${err.url}'`);
    } else {
      console.log(`An error occured: ${err}`);
    }
  });
};