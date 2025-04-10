'use client';

import { useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./input";
import { addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isSaturday } from "date-fns";
import { ko } from "date-fns/locale";

export interface DatePickerWithRangeRef {
  open: () => void;
  close: () => void;
}

export const DatePickerWithRange = forwardRef<DatePickerWithRangeRef, { 
  onOpen: () => void,
  className?: string,
  selectedRange: {start?: Date; end?: Date},
  onRangeChange: (range: {start?: Date; end?: Date}) => void
}>(
  ({ onOpen, className = '', selectedRange, onRangeChange }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const nextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
    const prevMonth = () => setCurrentDate(prev => addMonths(prev, -1));

    const generateCalendar = (baseDate: Date) => {
      const start = startOfMonth(baseDate);
      const end = endOfMonth(baseDate);
      return eachDayOfInterval({ start, end });
    };

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const currentMonthDays = generateCalendar(currentDate);
    const nextMonthDays = generateCalendar(addMonths(currentDate, 1));

    const handleDateClick = (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const clickedDate = new Date(date);
      clickedDate.setHours(0, 0, 0, 0);
      const isToday = clickedDate.getTime() === today.getTime();

      if (selectedRange.start && selectedRange.end && selectedRange.start.getTime() === date.getTime()) {
        if (isToday) {
          onRangeChange({ start: date });
        } else {
          onRangeChange({});
        }
        return;
      }

      if (!selectedRange.start) {
        onRangeChange({ start: date });
      } else if (!selectedRange.end) {
        const firstDate = selectedRange.start;
        const secondDate = date;
        const daysDiff = Math.ceil(Math.abs(secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 30) {
          if (secondDate > firstDate) {
            const maxEnd = new Date(firstDate);
            maxEnd.setDate(firstDate.getDate() + 29);
            onRangeChange({ start: firstDate, end: maxEnd });
          } else {
            const minStart = new Date(firstDate);
            minStart.setDate(firstDate.getDate() - 29);
            onRangeChange({ start: minStart, end: firstDate });
          }
        } else {
          onRangeChange({ 
            start: secondDate < firstDate ? secondDate : firstDate,
            end: secondDate > firstDate ? secondDate : firstDate
          });
        }

        setIsOpen(false);
        
        setTimeout(() => {
          const guestInput = document.querySelector('input[name="guest-count"]') as HTMLInputElement;
          if (guestInput) {
            guestInput.click();
          }
        }, 100);
      } else {
        onRangeChange({ start: date });
      }
    };

    const isInRange = (date: Date) => {
      if (!selectedRange.start || !selectedRange.end) return false;
      
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      
      const start = new Date(selectedRange.start);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(selectedRange.end);
      end.setHours(0, 0, 0, 0);
      
      return compareDate >= start && compareDate <= end;
    };

    const isStartDate = (date: Date) => {
      if (!selectedRange.start) return false;
      
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      
      const start = new Date(selectedRange.start);
      start.setHours(0, 0, 0, 0);
      
      return compareDate.getTime() === start.getTime();
    };

    const isEndDate = (date: Date) => {
      if (!selectedRange.end) return false;
      
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      
      const end = new Date(selectedRange.end);
      end.setHours(0, 0, 0, 0);
      
      return compareDate.getTime() === end.getTime();
    };

    const isSelectableDate = (date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      
      if (compareDate < today) return false;
      if (!selectedRange.start) return true;
      
      const firstDate = selectedRange.start;
      const minDate = new Date(firstDate);
      minDate.setDate(firstDate.getDate() - 30);
      const maxDate = new Date(firstDate);
      maxDate.setDate(firstDate.getDate() + 30);

      return compareDate >= minDate && compareDate <= maxDate;
    };

    const isToday = (date: Date) => {
      const today = new Date();
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    };

    const getDateButtonClasses = (date: Date) => {
      const isDisabled = !isSelectableDate(date);
      const isWeekend = isSaturday(date) || isSunday(date);
      
      let colorClass = '';
      if (isDisabled) {
        colorClass = 'text-gray-400';
      } else if (isWeekend) {
        colorClass = isSunday(date) ? 'text-red-500' : 'text-blue-500';
      }

      return `
        relative w-10 h-10 rounded-full
        ${colorClass}
        ${isStartDate(date) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
        ${isEndDate(date) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
        ${!isStartDate(date) && !isEndDate(date) ? 'hover:bg-gray-100' : ''}
        disabled:hover:bg-transparent
        transition-colors
        z-10
      `;
    };

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsOpen(true);
        onOpen();
      },
      close: () => setIsOpen(false)
    }));

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (isOpen && 
            !target.closest('.date-picker-wrapper')) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
      <div className="relative date-picker-wrapper">
        <Input
          value={selectedRange.start ? `${format(selectedRange.start, 'MM-dd')} ${format(selectedRange.start, 'E', { locale: ko })} - ${
            selectedRange.end ? `${format(selectedRange.end, 'MM-dd')} ${format(selectedRange.end, 'E', { locale: ko })} (${
              Math.ceil((selectedRange.end.getTime() - selectedRange.start.getTime()) / (1000 * 60 * 60 * 24))
            }박)` : ''
          }` : ''}
          placeholder="체크인 체크아웃 날자를 선택해주세요."
          className={`pl-10 ${className}`}
          readOnly
          onClick={() => {
            setIsOpen(true);
            onOpen();
          }}
        />

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-lg z-20 w-[700px]">
            <div className="flex gap-12 justify-center">
              {/* 달력 2개 */}
              {[currentDate, addMonths(currentDate, 1)].map((monthDate, i) => (
                <div key={i} className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    {i === 0 && (
                      <button onClick={prevMonth} className="text-gray-500 hover:text-gray-700">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    )}
                    <span className="font-medium text-lg">
                      {format(monthDate, 'yyyy년 M월')}
                    </span>
                    {i === 1 && (
                      <button onClick={nextMonth} className="text-gray-500 hover:text-gray-700">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-7 text-center">
                    {days.map(day => (
                      <div key={day} className="h-10 text-sm font-medium">
                        {day}
                      </div>
                    ))}
                    {generateCalendar(monthDate).map(date => (
                      <div key={date.toString()} className="relative p-[2px]">
                        {isInRange(date) && (
                          <div className={`
                            absolute top-1/2 -translate-y-1/2 h-8 bg-blue-100
                            ${isStartDate(date) ? 'left-1/2 right-0' : ''}
                            ${isEndDate(date) ? 'right-1/2 left-0' : ''}
                            ${!isStartDate(date) && !isEndDate(date) ? 'left-0 right-0' : ''}
                          `} />
                        )}
                        
                        <button
                          className={getDateButtonClasses(date)}
                          disabled={!isSelectableDate(date)}
                          onClick={() => handleDateClick(date)}
                        >
                          {format(date, 'd')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end border-t pt-4">
              <button 
                className="px-4 py-2 rounded-full text-sm text-red-500 hover:bg-red-50"
                onClick={() => {
                  onRangeChange({}); 
                }}
              >
                초기화
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
); 