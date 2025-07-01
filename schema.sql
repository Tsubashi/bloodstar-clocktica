-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: bloodstarsql.db
-- Generation Time: Jun 21, 2025 at 04:00 PM
-- Server version: 10.5.22-MariaDB-1:10.5.22+maria~ubu1804
-- PHP Version: 8.3.11-nfsn1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Database: `bloodstar`
--

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

CREATE TABLE `block` (
  `blocker` varchar(255) NOT NULL,
  `blockee` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `hash`
--

CREATE TABLE `hash` (
  `email` varchar(255) NOT NULL,
  `hash` char(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reset`
--

CREATE TABLE `reset` (
  `email` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL,
  `confirmHash` char(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `share`
--

CREATE TABLE `share` (
  `owner` varchar(255) NOT NULL,
  `edition` varchar(255) NOT NULL,
  `user` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `unconfirmed`
--

CREATE TABLE `unconfirmed` (
  `email` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL,
  `hash` char(60) NOT NULL,
  `confirmHash` char(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `email` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `hash`
--
ALTER TABLE `hash`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `reset`
--
ALTER TABLE `reset`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `share`
--
ALTER TABLE `share`
  ADD KEY `owner` (`owner`,`edition`);

--
-- Indexes for table `unconfirmed`
--
ALTER TABLE `unconfirmed`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`email`),
  ADD UNIQUE KEY `index_name` (`name`);
COMMIT;
