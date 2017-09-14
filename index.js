/*jshint esversion: 6 */
let download = require("download");
let inquirer = require("inquirer");
let fs = require("fs");
let mv = require("mv");
let pdf2json = require("pdf2json");
let baseFolder = "C:/Users/Rio/OneDrive - Christchurch Boys' High School/School Work/Year 12/NCEAPastPapers/"; 
let regFolder = new RegExp(/^[^\>\<\\\"\/\\\|\?\*]*[^ \.]$/);
//"C:/Users/Rio/Documents/NCEAPastPapers/";

let completed = 0; //How many downloads have finished (error or success)

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
  standardFolder: (standardCode, standardName) => `${standardCode} ${name.capitalizeWord(standardName)}`,
  standardFiles: (standard, year, type) => `${standard}-${year}-${type}.pdf`,
  concatDirectories: (...arr) => {
    arr = arr.map(str => str.replace("\\", "/")); //Replace backslashes with slash
    let str = "";
    for (let i of arr) {
      str += i;
      if (i.substr(-1) != "/") {
        str += "/"; //Add a backslash if there isn't one at the end
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
    validate: val => (val.match(/^\s*\d+\s*$/)) ? true : "Enter numerical standard code"
}, /*{
    type: "input",
    name: "subjectName",
    message: "Subject Name: ",
    validate: val => val.match(regFolder) ? true: "Please enter a valid folder name"
  },*/ {
    type: "input",
    name: "standardName",
    message: "Name of standard (e.g. Mechanics): ",
    validate: val => val.match(regFolder) ? true: "Please enter a valid folder name"
  }, {
    type: "input",
    name: "year",
    message: "Year of exam (or nothing for all from 2012): ",
    validate: val => (val.match(/(?:^\s*(?:\d{2}|\d{4})?\s*$)?/) ? true : "Enter 2/4 digit year, or nothing for all years")
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
  if (!val.newSaveLocation) {
    inquirer.prompt([{
      type: "directory",
      name: "saveLocation",
      message: "Base folder to save in: ",
      basePath: baseFolder
    }]).then(dir => {
      let dirNames = dir.saveLocation.replace("\\", "/"); //array of directories
      dirNames = dirNames.split("/");
      folderName = dirNames[dirNames.length - 1]; //The name of the 'deepest' folder/folder directly above the file
      if (folderName.match(val.standard) || folderName.toLowerCase().match(val.standardName.trim().toLowerCase())) {
        //If the folder name has the standard code or name in it, assume that the user wants the files directly in there
        parseInput(val, name.concatDirectories(baseFolder, dir.saveLocation));
      }
      else {
        parseInput(val, name.concatDirectories(baseFolder, dir.saveLocation, name.standardFolder(val.standard, val.standardName)));
      }
    }
  ).catch(err => {
      throw new Error(err);
    });
  } else {
    parseInput(val, name.concatDirectories(baseFolder, name.standardFolder(val.standard, val.standardName)));
  }

}).catch(err => {
  throw new Error(err);
});


function parseInput(result, directory) {
  console.log(result);
  console.log(directory);
  let year = parseInt(result.year, 10);
  let standard = parseInt(result.standard, 10);

  if (isNaN(standard)) {
    throw new TypeError();
  }

  if (result.year.trim() === "") {
    for (let i = 2012; i < new Date().getFullYear(); i++) {
      //download all exams up to current year
      // console.log(linkAnswers(i, standard));
      downloadPaper(directory, linkAnswers(i, standard), result.downloadOptions);
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
  downloadPaper(directory, linkAnswers(year, standard), result.downloadOptions);
  return 0;
}




let linkAnswers = (year, standard) => {
  let baseLink = "http://www.nzqa.govt.nz/nqfdocs/ncea-resource";
  let obj = {
    year: year,
    standard: standard,
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



let getSubject = pdfLink =>  {
  let pdfParser = new pdf2json(); 
  let reg = /Level (\d) (\w+) \((d+)\) (\d{4})/g; 

  pdfParser.loadPDF(pdfLink); 
  
  return new Promise((resolve, reject) =>  {
    pdfParser.on("pdfParser_dataError", errData =>  {
      reject(errData.parserError); 
    }); 

    pdfParser.on("pdfParser_dataReady", pdfData =>  {

      let text = pdfData.formImage.Agency; 

      if (text.search(reg) > -1) {
        let arr = reg.exec(text);
        let obj = {
          yearLevel: arr[1],
          subject: arr[2],
          standard: arr[3],
          year: arr[4]
        };

        resolve(obj); 
      } else {
        reject(text); 
      }
    }); 
  });
};



let downloadPaper = (folder, object, toDownload) => {
  //return 0; //Temporary
  console.log(`Downloading ${object.year} ${object.standardName} (${object.standard}) papers to ${folder}`);

  //let getFileName = (object, type) => `${object.standard}-${object.year}-${type}.pdf`;
  //let folder = baseFolder;

  Promise.all(toDownload.map(i=>download(object[i], folder, {
      filename: name.standardFiles(object.standard, object.year , i)
    }))).then(val=> {
      console.log(`Downloads finished: ${val}`);
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