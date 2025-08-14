create database databaseprojectT;
use databaseprojectT;

create table Driver
(
    D_ID int primary key,
    dname varchar(100),
    contactnum int,
    insuranceDoc varchar(100),
    PaymentMethod varchar(100),
    Statuss int,
    LicenceNumber int
);

describe Driver;


create table Vehicle
(
    V_ID int primary key,
    vtype varchar(100),
    LicencePlate varchar(100),
    MaintenanceStat varchar(100),
    ChildSeat int
);

describe Vehicle;

create table Passenger
(
    P_ID int primary key,
    pname varchar(100),
    contactnum int,
    CreditCardInfo varchar(100)
);

describe Passenger;

create table Feedback
(
    F_ID int primary key,
    Rating int,
    Comment varchar(255),
    SubmittedTo varchar(100),
    SubmittedBy varchar(100),
    P_ID int,
    D_ID int,
    foreign key (P_ID) references Passenger(P_ID),
    foreign key (D_ID) references Driver(D_ID)
);
describe Feedback;


create table Ride
(
    Ride_ID int primary key,
    PickupLocation varchar(100),
    Dropoff varchar(100),
    TimeStamp datetime,
    Statuss int,
    V_ID int,
    D_ID int,
    P_ID int,
    F_ID int,
    foreign key (V_ID) references Vehicle(V_ID),
    foreign key (D_ID) references Driver(D_ID),
    foreign key (P_ID) references Passenger(P_ID),
    foreign key (F_ID) references Feedback(F_ID)
);
describe Ride;


create table Promotion
(
    P_Code varchar(100) primary key,
    PDescription varchar(255),
    Percentage float,
    Startt date,
    Endd date,
    Statuss int
);
describe Promotion;

create table Payment
(
    Payment_ID int primary key,
    Amount float,
    PaymentMethod varchar(100),
    Statuss int,
    TimeStamp datetime,
    PromoUsed varchar(100),
    P_ID int,
    Ride_ID int,
    P_Code varchar(100),
    foreign key (P_ID) references Passenger(P_ID),
    foreign key (Ride_ID) references Ride(Ride_ID),
    foreign key (P_Code) references Promotion(P_Code)
);
describe Payment;


create table SupportReq
(
    S_ID int primary key,
    SubmittedBy varchar(100),
    IssueType varchar(100),
    IssueDesc varchar(255),
    IssueStatus varchar(100),
    D_ID int,
    P_ID int,
    foreign key (D_ID) references Driver(D_ID),
    foreign key (P_ID) references Passenger(P_ID)
);
describe SupportReq;

CREATE TABLE Maintenance (
    M_ID INT PRIMARY KEY,
    V_ID INT,
    Description VARCHAR(255),
    DatePerformed DATE,
    Cost FLOAT,
    Statuss VARCHAR(100),
    FOREIGN KEY (V_ID) REFERENCES Vehicle(V_ID)
);
DESCRIBE Maintenance;

CREATE TABLE Schedule 
(
    Sch_ID INT PRIMARY KEY,
    D_ID INT,
    V_ID INT,
    StartTime DATETIME,
    EndTime DATETIME,
    Statuss VARCHAR(100),
    FOREIGN KEY (D_ID) REFERENCES Driver(D_ID),
    FOREIGN KEY (V_ID) REFERENCES Vehicle(V_ID)
);
DESCRIBE Schedule;

select *from passenger;
select *from Driver;
select *from Maintenance;
select *from SupportReq;
select *from Payment;
select *from Promotion;
select *from Ride;
select *from Vehicle;
select*from feedback;

