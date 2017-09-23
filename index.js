/*jshint esversion: 6 */
let download = require("download");
let inquirer = require("inquirer");
let fs = require("fs");
// let mv = require("mv");
//let pdf2json = require("pdf2json");
let baseFolder = "C:/Users/Rio/OneDrive - Christchurch Boys' High School/School Work/Year 12/NCEAPastPapers/"; 



let reg = {
  file: new RegExp(/\.\w+$/g),
  directoryWindows: new RegExp(/^[^\>\<\\\"\/\|\?\*]*[^ \.]$/),
  integer: new RegExp(/^\s*\d+\s*$/),
  year_2_4: new RegExp(/(?:^\s*(?:\d{2}|\d{4})?\s*$)?/)
};


let name = {
  capitalizeWord: (string, justTheFirstWord) => {
    if (justTheFirstWord) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    else {
      let arr = string.split(" "); //Only works with spaces. Consider looping with reg.exec to capitalize and add the matched whitespace character
      let str = "";
      for (let i of arr) {
        str += name.capitalizeWord(i, true);
      }
      return str;
    }
  },
  standardFolder: (standardCode, standardName) => `${standardCode} ${name.capitalizeWord(standardName, false)}`,
  standardFile: (standard, year, type) => `${standard}-${year}-${type}.pdf`,
  concatDir: (...arr) => {
    arr = arr.map(str => str.replace("\\", "/")); //Replace backslashes with slash
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


inquirer.registerPrompt("directory", require("inquirer-directory"));

inquirer.prompt([{
    type: "input",
    name: "standard",
    message: "Standard code: ",
    validate: val => (val.match(reg.integer)) ? true : "Enter numerical standard code"
  }, {
    type: "input",
    name: "standardName",
    message: "Name of standard (e.g. Mechanics): ",
    validate: val => val.match(reg.folderWindows) ? true: "Please enter a valid folder name"
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
    message: `Download to '${baseFolder}'?`,
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
    //Because async/promises
    let newDir = directorySearch(dir, 
      folder => (folder.includes(val.standardCode) || folder.toLowerCase().includes(val.standardName.toLowerCase)), 2);
    //newDir is the full path of the new directory
    if (newDir) {
      console.log(`Automatically detected folder, ${name.concatDir(newDir)}`);
      parseInput(val, newDir);
    }
    else {
      console.log(`Downloading to folder, ${name.concatDir(baseFolder, deepest)}`);
      parseInput(val, name.concatDir(dir, name.standardFolder(val.standard, val.standardName)));
    }
  };
  
  if (!val.newSaveLocation) {
    inquirer.prompt([{
      type: "directory",
      name: "saveLocation",
      message: "Base folder to save in: ",
      basePath: baseFolder
    }]).then(newDir => func(val, name.concatDir((baseFolder, newDir.saveLocation)))).catch(err => {
      throw new Error(err);
    });
  }
  else {
    func(val, baseFolder);
  }
}).catch(err => {
  throw new Error(err);
});




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

      try {
        let folders = fs.readdirSync(directory).filter(name => !name.match(reg.file));
      
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
      }
      catch(err) {
        console.log(err);
        //Errors with ENOTDIR (not directory) or EPERM (not permitted) etc. 
      }
    };
    let dirName = search(directory, 1, maxSearchDepth); //Start depth at 0
    console.log(dirName);
    if (dirName) return dirName;
  }

  return false; //No matches
}



function parseInput(result, directory) {
  // console.log(result);
  console.log(`Downloading to ${directory}`);
  let year = parseInt(result.year, 10);
  let standard = parseInt(result.standard, 10);

  if (isNaN(standard)) {
    throw new TypeError();
  }

  if (result.year.trim() === "") {
    for (let i = 2012; i < new Date().getFullYear(); i++) {
      //download all exams up to current year
      downloadPaper(directory, linkAnswers(i, standard, result.standardName), result.downloadOptions);
    }
    return 0; //Exit function
  }

  if (isNaN(year)) {
    throw new TypeError();
  }

  if (year < 100) {
    year = Math.floor(new Date().getFullYear() / 100) * 100 + year; //If two digit year, make it 4 digit
  }

  // console.log(linkAnswers(year, standard));
  downloadPaper(directory, linkAnswers(year, standard, result.standardName), result.downloadOptions);
  return 0;
}




let linkAnswers = (year, standard, standardName) => {
  let baseLink = "http://www.nzqa.govt.nz/nqfdocs/ncea-resource";
  let obj = {
    year: year,
    standard: standard,
    standardName: standardName,
    exam: `${baseLink}/exams/${year}/${standard}-exm-${year}.pdf`,
    marking: `${baseLink}/schedules/${year}/${standard}-ass-${year}.pdf`, 
    notachieved: `${baseLink}/examplars/${year}/${standard}-exp-${year}-notachieved.pdf`,
    achieved: `${baseLink}/examplars/${year}/${standard}-exp-${year}-achieved.pdf`,
    merit: `${baseLink}/examplars/${year}/${standard}-exp-${year}-merit.pdf`,
    excellence: `${baseLink}/examplars/${year}/${standard}-exp-${year}-excellence.pdf`,
    resource: `${baseLink}/exams/${year}/${standard}-res-${year}.pdf`
  };
  return obj;
};



let downloadPaper = (folder, object, toDownload) => {
  // return 0; //Temporary
  console.log(`Downloading ${object.year} ${object.standardName} (${object.standard}) papers to ${folder}`);


  //let getFileName = (object, type) => `${object.standard}-${object.year}-${type}.pdf`;
  //let folder = baseFolder;
  for (let i = toDownload.length - 1; i >= 0; i--) {
    if (fs.existsSync(name.concatDir(folder, name.standardFile(object.standard, object.year, toDownload[i])))) {
      //Checks if the file that is going to be created actually exists
      console.log(`'${name.standardFile(object.standard, object.year, toDownload[i])}' already exists: skipping download`);
      toDownload = toDownload.splice(i, 1); //Remove element from the array
      //Going in reverse, so removing an element will have no effect on the ones before it
    }
  }

  return 0;
  Promise.all(toDownload.map(i=>download(object[i], folder, {
      filename: name.standardFile(object.standard, object.year , i)
    }))).then(val=> {
      console.log(`Downloads for ${object.year} ${object.standardName} finished`);
    }).catch(err=>{
      if (err.name == "HTTPError" && err.statusCode == 404) {
        console.log(`404 (File not found) error downloading '${err.url}'`);
      }
    });
  
/*
  completed = 0;
  let downloadFile = (object, type) => {
    let options = {
      directory: baseFolder + object.standard + "/",
      //type is string: paper/excellence/marking
      filename: object.standard + "-" + object.year + "-" + type + ".pdf"
    };

    let subjectData;
    download(object[type], options, err => {
      if (err) {
        console.log(`${object.year} ${type} paper for standard ${object.standard} not downloaded: ${err}`);
      } else {
        console.log("Parsing PDF for subject");
        let subject;
        getSubject(options.directory + options.filename).then(val=>subjectData = val).catch(err=>console.log(err));

        console.log(`${object.year} ${type} paper for standard ${object.standard} downloaded`);
      }
      completed++;
    });
  };

  for (let i of toDownload) {
    downloadFile(object, i);
  }

  while(completed < toDownload.length - 1) {
    //If not all have finished
    //Infinite loop- not good
  }
  
  if (subjectData) {
    //If subject data is found
    console.log(`Attempting to move '${baseFolder}${object.standard}/' to ${baseFolder}.${subjectData.subject}/${object.standard}`);
    mv(baseFolder + object.standard, baseFolder + subjectData.subject + "/" + object.standard, err=> {
      console.log(`Error moving folder: ${err}`);
    });
  }
  */
};