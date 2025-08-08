import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const SIGNUP_STEPS = {
  EMAIL: 'email',
  PASSWORD: 'password',
  USERNAME: 'username',
  LOCATION: 'location',
  BIRTHDAY: 'birthday',
  GENDER: 'gender',
  COMPLETE: 'complete'
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
  'France', 'Italy', 'Spain', 'Japan', 'South Korea', 'Brazil', 'Mexico',
  'India', 'China', 'Other'
];

export default function SignUpScreen({ onSignUpComplete, onBack }) {
  const [currentStep, setCurrentStep] = useState(SIGNUP_STEPS.EMAIL);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    location: '',
    birthday: { month: '', day: '', year: '' },
    gender: ''
  });
  const [loading, setLoading] = useState(false);

  // Mock existing usernames for validation (in real app, this would be from backend)
  const existingUsernames = ['fashionlover', 'colormaster', 'styleicon', 'trendsettr', 'artlover'];

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateUsername = async (username) => {
    if (username.length < 3) {
      return {
        isValid: false,
        message: 'Username must be at least 3 characters'
      };
    }

    try {
      // Check username availability with backend API
      const response = await ApiService.checkUsername(username);
      return {
        isValid: response.available,
        message: response.available ? '' : 'Username already taken'
      };
    } catch (error) {
      console.error('Username validation error:', error);
      // Fallback to local validation if API fails
      const isUnique = !existingUsernames.includes(username.toLowerCase());
      return {
        isValid: isUnique,
        message: isUnique ? '' : 'Username already taken'
      };
    }
  };

  const handleNext = async () => {
    setLoading(true);
    
    try {
      switch (currentStep) {
        case SIGNUP_STEPS.EMAIL:
          if (!validateEmail(formData.email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address');
            setLoading(false);
            return;
          }
          setCurrentStep(SIGNUP_STEPS.PASSWORD);
          break;

        case SIGNUP_STEPS.PASSWORD:
          if (formData.password.length < 6) {
            Alert.alert('Weak Password', 'Password must be at least 6 characters');
            setLoading(false);
            return;
          }
          setCurrentStep(SIGNUP_STEPS.USERNAME);
          break;

        case SIGNUP_STEPS.USERNAME:
          const usernameValidation = await validateUsername(formData.username);
          if (!usernameValidation.isValid) {
            Alert.alert('Invalid Username', usernameValidation.message);
            setLoading(false);
            return;
          }
          setCurrentStep(SIGNUP_STEPS.LOCATION);
          break;

        case SIGNUP_STEPS.LOCATION:
          if (!formData.location) {
            Alert.alert('Location Required', 'Please select your location');
            setLoading(false);
            return;
          }
          setCurrentStep(SIGNUP_STEPS.BIRTHDAY);
          break;

        case SIGNUP_STEPS.BIRTHDAY:
          if (!formData.birthday.month || !formData.birthday.day || !formData.birthday.year) {
            Alert.alert('Birthday Required', 'Please enter your complete birthday');
            setLoading(false);
            return;
          }
          setCurrentStep(SIGNUP_STEPS.GENDER);
          break;

        case SIGNUP_STEPS.GENDER:
          if (!formData.gender) {
            Alert.alert('Gender Required', 'Please select your gender');
            setLoading(false);
            return;
          }
          await completeSignUp();
          break;
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
    
    setLoading(false);
  };

  const completeSignUp = async () => {
    try {
      // Register user with backend API
      const registrationData = {
        email: formData.email,
        password: formData.password,
        username: formData.username,
        location: formData.location,
        birthday: formData.birthday,
        gender: formData.gender
      };

      const response = await ApiService.register(registrationData);
      
      if (response.success && response.user) {
        // Store user data locally for offline access
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('authToken', response.token);
        
        setCurrentStep(SIGNUP_STEPS.COMPLETE);
        
        // Auto-complete after showing success
        setTimeout(() => {
          onSignUpComplete(response.user);
        }, 2000);
      } else {
        Alert.alert('Registration Failed', response.message || 'Failed to create account');
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error.message.includes('fetch')) {
        Alert.alert('Connection Error', 'Unable to connect to server. Please check your internet connection.');
      } else {
        Alert.alert('Registration Error', error.message || 'Failed to create account. Please try again.');
      }
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case SIGNUP_STEPS.EMAIL:
        onBack();
        break;
      case SIGNUP_STEPS.PASSWORD:
        setCurrentStep(SIGNUP_STEPS.EMAIL);
        break;
      case SIGNUP_STEPS.USERNAME:
        setCurrentStep(SIGNUP_STEPS.PASSWORD);
        break;
      case SIGNUP_STEPS.LOCATION:
        setCurrentStep(SIGNUP_STEPS.USERNAME);
        break;
      case SIGNUP_STEPS.BIRTHDAY:
        setCurrentStep(SIGNUP_STEPS.LOCATION);
        break;
      case SIGNUP_STEPS.GENDER:
        setCurrentStep(SIGNUP_STEPS.BIRTHDAY);
        break;
    }
  };

  const getStepProgress = () => {
    const steps = Object.values(SIGNUP_STEPS);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex + 1;
  };

  const renderProgressDots = () => {
    const totalSteps = 6; // Email, Password, Username, Location, Birthday, Gender
    const currentStepNumber = getStepProgress();
    
    return (
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index < currentStepNumber ? styles.progressDotActive : styles.progressDotInactive
            ]}
          />
        ))}
      </View>
    );
  };

  const renderEmailStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your email?</Text>
      <TextInput
        style={styles.input}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
    </View>
  );

  const renderPasswordStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create a password</Text>
      <TextInput
        style={styles.input}
        value={formData.password}
        onChangeText={(text) => setFormData({ ...formData, password: text })}
        placeholder="Enter password"
        secureTextEntry
        autoCapitalize="none"
      />
      <Text style={styles.helperText}>Password must be at least 6 characters</Text>
    </View>
  );

  const renderUsernameStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Create a username</Text>
      <TextInput
        style={styles.input}
        value={formData.username}
        onChangeText={(text) => setFormData({ ...formData, username: text.toLowerCase() })}
        placeholder="Enter username"
        autoCapitalize="none"
        autoComplete="username"
      />
      <Text style={styles.helperText}>
        This will be your unique identifier. Choose something memorable!
      </Text>
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where do you live?</Text>
      <Text style={styles.stepSubtitle}>
        This helps us find you more relevant content. We won't show it on your profile.
      </Text>
      <ScrollView style={styles.optionsList}>
        {COUNTRIES.map((country) => (
          <TouchableOpacity
            key={country}
            style={[
              styles.optionButton,
              formData.location === country && styles.optionButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, location: country })}
          >
            <Text style={[
              styles.optionText,
              formData.location === country && styles.optionTextSelected
            ]}>
              {country}
            </Text>
            {formData.location === country && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderBirthdayStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Hey {formData.username} ✏️</Text>
      <Text style={styles.stepTitle}>Enter your birthdate</Text>
      <Text style={styles.stepSubtitle}>
        Knowing your age helps keep Pinterest safe for everyone. It won't be visible to others.
      </Text>
      <Text style={styles.helperText}>
        Use your own birthdate, even if this is a business account
      </Text>
      
      <View style={styles.birthdayContainer}>
        <ScrollView style={styles.birthdayPicker}>
          {MONTHS.map((month, index) => (
            <TouchableOpacity
              key={month}
              style={[
                styles.birthdayOption,
                formData.birthday.month === month && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, month }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.month === month && styles.birthdayTextSelected
              ]}>
                {month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.birthdayPicker}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.birthdayOption,
                formData.birthday.day === day.toString() && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, day: day.toString() }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.day === day.toString() && styles.birthdayTextSelected
              ]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.birthdayPicker}>
          {Array.from({ length: 50 }, (_, i) => 2024 - i).map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                styles.birthdayOption,
                formData.birthday.year === year.toString() && styles.birthdayOptionSelected
              ]}
              onPress={() => setFormData({
                ...formData,
                birthday: { ...formData.birthday, year: year.toString() }
              })}
            >
              <Text style={[
                styles.birthdayText,
                formData.birthday.year === year.toString() && styles.birthdayTextSelected
              ]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderGenderStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your gender?</Text>
      <Text style={styles.stepSubtitle}>
        This will influence the content you see. It won't be visible to others.
      </Text>
      
      <View style={styles.genderContainer}>
        {['Female', 'Male', 'Specify another'].map((gender) => (
          <TouchableOpacity
            key={gender}
            style={[
              styles.genderButton,
              formData.gender === gender && styles.genderButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, gender })}
          >
            <Text style={[
              styles.genderText,
              formData.gender === gender && styles.genderTextSelected
            ]}>
              {gender}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeIcon}>🎉</Text>
      <Text style={styles.completeTitle}>Welcome to Fashion Color Wheel!</Text>
      <Text style={styles.completeSubtitle}>
        Your account has been created successfully. Get ready to discover amazing color combinations!
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case SIGNUP_STEPS.EMAIL:
        return renderEmailStep();
      case SIGNUP_STEPS.PASSWORD:
        return renderPasswordStep();
      case SIGNUP_STEPS.USERNAME:
        return renderUsernameStep();
      case SIGNUP_STEPS.LOCATION:
        return renderLocationStep();
      case SIGNUP_STEPS.BIRTHDAY:
        return renderBirthdayStep();
      case SIGNUP_STEPS.GENDER:
        return renderGenderStep();
      case SIGNUP_STEPS.COMPLETE:
        return renderCompleteStep();
      default:
        return renderEmailStep();
    }
  };

  if (currentStep === SIGNUP_STEPS.COMPLETE) {
    return (
      <View style={styles.container}>
        {renderCompleteStep()}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        {renderProgressDots()}
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, loading && styles.nextButtonDisabled]} 
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Loading...' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#333',
  },
  progressDotInactive: {
    backgroundColor: '#ddd',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'left',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  helperText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginTop: 20,
  },
  optionsList: {
    maxHeight: 300,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#333',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  optionTextSelected: {
    color: '#fff',
  },
  checkmark: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  birthdayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  birthdayPicker: {
    flex: 1,
    maxHeight: 200,
    marginHorizontal: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
  },
  birthdayOption: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  birthdayOptionSelected: {
    backgroundColor: '#333',
  },
  birthdayText: {
    fontSize: 16,
    color: '#333',
  },
  birthdayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  genderContainer: {
    marginTop: 30,
  },
  genderButton: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonSelected: {
    backgroundColor: '#333',
    borderColor: '#333',
  },
  genderText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  genderTextSelected: {
    color: '#fff',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completeIcon: {
    fontSize: 80,
    marginBottom: 30,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  nextButton: {
    backgroundColor: '#e60023',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
